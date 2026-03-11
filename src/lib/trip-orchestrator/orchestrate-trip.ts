import type { Location, Vehicle, TripSettings } from '../../types';
import { calculateRoute } from '../api';
import { calculateTripCosts, calculateArrivalTimes } from '../calculations';
import { buildRoundTripSegments } from '../trip-calculation-helpers';
import { splitTripByDays, calculateCostBreakdown, getBudgetStatus } from '../budget';
import { generateSmartStops, createStopConfig } from '../stop-suggestions';
import type { SuggestedStop } from '../stop-suggestions';
import { fetchWeather } from '../weather';
import { validateTripInputs } from '../validate-inputs';
import { buildTimedTimeline } from '../trip-timeline';
import { applyComboOptimization } from '../stop-consolidator';
import { enrichSmartStopHubs } from '../route-geocoder';

import type { TripOrchestrationResult } from './orchestrator-types';
import { TripCalculationError } from './orchestrator-types';
import {
  getRoundTripDayTripStayMinutes,
  projectFuelStopsFromSimulation,
  assembleCanonicalTimeline,
  patchDaysFromCanonicalEvents
} from './orchestrator-helpers';

/**
 * Execute the full trip calculation pipeline. Pure async — no React state.
 * Throws TripCalculationError for expected failures (no route, validation).
 */
export async function orchestrateTrip(
  locations: Location[],
  vehicle: Vehicle,
  settings: TripSettings,
): Promise<TripOrchestrationResult> {
  const routeData = await calculateRoute(locations, {
    avoidTolls: settings.avoidTolls,
    avoidBorders: settings.avoidBorders,
    scenicMode: settings.scenicMode,
  });

  if (!routeData) throw new TripCalculationError('Could not calculate route. Please check your locations.');

  const validationErrors = validateTripInputs(routeData.segments, settings);
  if (validationErrors.length > 0) throw new TripCalculationError(validationErrors[0]);

  const tripSummary = calculateTripCosts(routeData.segments, vehicle, settings);
  tripSummary.fullGeometry = routeData.fullGeometry;

  // Fetch weather — allSettled so one slow/failed request doesn't block
  const weatherResults = await Promise.allSettled(
    tripSummary.segments.map(async (seg) => {
      const weather = await fetchWeather(
        seg.to.lat, seg.to.lng, settings.departureDate,
        AbortSignal.timeout(5000),
      );
      return { ...seg, weather: weather || undefined };
    })
  );
  const segmentsWithWeather = weatherResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...tripSummary.segments[i] }
  );

  let segmentsWithTimes = calculateArrivalTimes(
    segmentsWithWeather, settings.departureDate, settings.departureTime,
  );

  let roundTripMidpoint: number | undefined;
  if (settings.isRoundTrip) {
    const rt = buildRoundTripSegments(segmentsWithTimes, tripSummary, settings, vehicle);
    segmentsWithTimes = rt.segments;
    roundTripMidpoint = rt.roundTripMidpoint;
  }

  // Stamp stopType = 'overnight' on segments ending at overnight-intent waypoints.
  // splitTripByDays already handles isOvernightStop via segment.stopType — this is
  // the only change needed to pin day boundaries at user-declared overnight stops.
  segmentsWithTimes = segmentsWithTimes.map((seg) =>
    seg.to.intent?.overnight && seg.to.type === 'waypoint'
      ? { ...seg, stopType: 'overnight' as const }
      : seg
  );

  tripSummary.segments = segmentsWithTimes;
  tripSummary.roundTripMidpoint = roundTripMidpoint;

  const tripDays = splitTripByDays(
    segmentsWithTimes, settings,
    settings.departureDate, settings.departureTime,
    roundTripMidpoint, routeData.fullGeometry,
  );
  tripSummary.days = tripDays;
  // Patch drivingDays from the actual day splitter (calculations.ts uses a flat
  // ceiling divide that ignores overflow tolerance, fatigue streaks, and multi-driver
  // bonuses — on long trips this can drift 1-2 days from the real split count).
  tripSummary.drivingDays = tripDays.filter(d => d.dayType !== 'free').length;

  if (tripDays.length > 0) {
    tripSummary.costBreakdown = calculateCostBreakdown(tripDays, settings.numTravelers);
    tripSummary.budgetStatus = getBudgetStatus(settings.budget, tripSummary.costBreakdown);
    tripSummary.budgetRemaining = settings.budget.total - tripSummary.costBreakdown.total;
    tripSummary.totalFuelCost = tripSummary.costBreakdown.fuel;
    tripSummary.costPerPerson = settings.numTravelers > 0
      ? tripSummary.totalFuelCost / settings.numTravelers
      : tripSummary.totalFuelCost;
  }

  const rawSmartStops = generateSmartStops(
    tripSummary.segments,
    createStopConfig(vehicle, settings, tripSummary.fullGeometry, tripSummary.segments[0]?.from.lng),
    tripDays,
  );
  const smartStops = await enrichSmartStopHubs(rawSmartStops);

  // Inject user-declared stop intent (fuel, meal) as required stops.
  // These honour the user's explicit waypoint checkboxes in Step 1.
  // TODO: overnight intent requires modifying splitTripByDays to pin day boundaries —
  //       tracked for a future session (needs deeper split-by-days integration).
  const intentStops: SuggestedStop[] = [];
  tripSummary.segments.forEach((seg, idx) => {
    const intent = seg.to.intent;
    if (!intent || seg.to.type !== 'waypoint') return;
    const estimatedTime = seg.arrivalTime ? new Date(seg.arrivalTime) : new Date();
    const defaultDwell = (intent.fuel ? 15 : 0) + (intent.meal ? 45 : 0);
    const dwell = intent.dwellMinutes ?? defaultDwell;
    if (intent.fuel) {
      // Fuel (with optional combined meal) — single stop, comboMeal flag if both checked
      intentStops.push({
        id: `intent-fuel-${seg.to.id}`,
        type: 'fuel',
        reason: `Fuel stop at ${seg.to.name} (planned)`,
        afterSegmentIndex: idx,
        estimatedTime,
        duration: dwell,
        priority: 'required',
        details: { comboMeal: !!intent.meal },
        hubName: seg.to.name,
        accepted: true,
      });
    } else if (intent.meal) {
      intentStops.push({
        id: `intent-meal-${seg.to.id}`,
        type: 'meal',
        reason: `Meal break at ${seg.to.name} (planned)`,
        afterSegmentIndex: idx,
        estimatedTime,
        duration: dwell,
        priority: 'required',
        details: {},
        hubName: seg.to.name,
        accepted: true,
      });
    }
  });
  const allSmartStops = [...smartStops, ...intentStops];

  const destinationStayMinutes = getRoundTripDayTripStayMinutes(tripSummary, tripDays.length, settings);

  const timedRaw = buildTimedTimeline(
    tripSummary.segments, allSmartStops, settings,
    roundTripMidpoint, destinationStayMinutes, tripDays,
  );
  const canonicalEvents = applyComboOptimization(timedRaw);

  patchDaysFromCanonicalEvents(tripDays, canonicalEvents);

  const canonicalTimeline = assembleCanonicalTimeline(
    canonicalEvents, tripDays, tripSummary,
    { locations: [...locations], vehicle, settings },
  );

  return {
    tripSummary,
    canonicalTimeline,
    projectedFuelStops: projectFuelStopsFromSimulation(allSmartStops),
    smartStops: allSmartStops,
    roundTripMidpoint,
  };
}

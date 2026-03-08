/**
 * Pure trip calculation pipeline — no React, no setState, no side effects.
 * route → costs → weather → times → days → stops → timeline → canonical events
 */

import type { Location, Vehicle, TripSettings, TripSummary, TripDay, StopType } from '../types';
import type { StrategicFuelStop } from './calculations';
import type { SuggestedStop } from './stop-suggestion-types';
import type { CanonicalTripTimeline, CanonicalTripDay } from './canonical-trip';
import type { TimedEvent } from './trip-timeline';
import { groupEventsByTripDay } from './accepted-itinerary-timeline';
import { calculateRoute } from './api';
import { calculateTripCosts, calculateArrivalTimes } from './calculations';
import { buildRoundTripSegments } from './trip-calculation-helpers';
import { splitTripByDays, calculateCostBreakdown, getBudgetStatus } from './budget';
import { generateSmartStops, createStopConfig } from './stop-suggestions';
import { fetchWeather } from './weather';
import { validateTripInputs } from './validate-inputs';
import { buildTimedTimeline } from './trip-timeline';
import { applyComboOptimization } from './stop-consolidator';
import { formatDateInZone } from './trip-timezone';
import { formatTime } from './trip-timeline-helpers';
import { enrichSmartStopHubs } from './route-geocoder';

/** Thrown for expected failures (no route, validation) — carries user-facing message. */
export class TripCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripCalculationError';
  }
}

export interface TripOrchestrationResult {
  tripSummary: TripSummary;
  canonicalTimeline: CanonicalTripTimeline;
  projectedFuelStops: StrategicFuelStop[];
  smartStops: SuggestedStop[];
  roundTripMidpoint?: number;
}

export interface StopUpdateResult {
  updatedSummary: TripSummary;
  canonicalTimeline: CanonicalTripTimeline;
  projectedFuelStops: StrategicFuelStop[];
}

function getRoundTripDayTripStayMinutes(
  summary: TripSummary,
  dayCount: number,
  settings: TripSettings,
): number {
  const isRTDayTrip = settings.isRoundTrip &&
    dayCount <= 1 &&
    summary.totalDurationMinutes <= settings.maxDriveHours * 60;

  return isRTDayTrip ? (settings.dayTripDurationHours ?? 0) * 60 : 0;
}

/** Project simulation fuel stops onto the map pin shape. */
export function projectFuelStopsFromSimulation(stops: SuggestedStop[]): StrategicFuelStop[] {
  return stops
    .filter(s => s.type === 'fuel' && !s.dismissed && s.lat != null && s.lng != null)
    .map(s => {
      const timeStr = formatTime(s.estimatedTime);
      return {
        lat: s.lat!,
        lng: s.lng!,
        distanceFromStart: s.distanceFromStart ?? 0,
        estimatedTime: timeStr,
        fuelRemaining: s.details.fillType === 'full' ? 15 : 35,
        stationName: s.hubName,
        cost: s.details.fuelCost,
        isFullFill: s.details.fillType === 'full',
      };
    });
}

/** Group flat canonical events into per-day buckets paired with budget metadata. */
export function assembleCanonicalTimeline(
  events: CanonicalTripTimeline['events'],
  tripDays: TripDay[],
  summary: TripSummary,
  inputs: CanonicalTripTimeline['inputs'],
): CanonicalTripTimeline {
  const days: CanonicalTripDay[] = groupEventsByTripDay(events, tripDays);
  return { events, days, summary, inputs };
}

/** Patch TripDay departure/arrival times and route labels from canonical events. */
export function patchDaysFromCanonicalEvents(tripDays: TripDay[], canonicalEvents: TimedEvent[]): void {
  for (const day of tripDays) {
    if (day.segments.length === 0) continue;
    const depEvent = canonicalEvents.find(
      e => e.type === 'departure' && formatDateInZone(e.arrivalTime, e.timezone ?? 'UTC') === day.date
    );
    let arrEvent: TimedEvent | undefined;
    if (depEvent) {
      const depMs = depEvent.arrivalTime.getTime();
      const nextDepMs = canonicalEvents.find(
        e => e.type === 'departure' && e.arrivalTime.getTime() > depMs
      )?.arrivalTime.getTime() ?? Infinity;

      arrEvent = canonicalEvents
        .filter(e =>
          (e.type === 'overnight' || e.type === 'arrival') &&
          e.arrivalTime.getTime() > depMs &&
          e.arrivalTime.getTime() <= nextDepMs
        )
        .at(-1);

      // Beast mode fallback: last waypoint in the window is the day-boundary event.
      if (!arrEvent) {
        arrEvent = canonicalEvents
          .filter(e =>
            e.type === 'waypoint' &&
            e.arrivalTime.getTime() > depMs &&
            e.arrivalTime.getTime() <= nextDepMs
          )
          .at(-1);
      }
    }
    if (depEvent) day.totals.departureTime = depEvent.arrivalTime.toISOString();
    if (arrEvent) day.totals.arrivalTime = arrEvent.arrivalTime.toISOString();
    if (depEvent && !day.route) {
      let toCity = day.segments.at(-1)?.to.name ?? '';
      toCity = toCity.replace(/\s*\(transit\)\s*$/, '');
      if (toCity.includes(' → ')) toCity = toCity.split(' → ').pop()!.trim();
      if (toCity) day.route = `${depEvent.locationHint} → ${toCity}`;
    }
  }
}

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

  const destinationStayMinutes = getRoundTripDayTripStayMinutes(tripSummary, tripDays.length, settings);

  const timedRaw = buildTimedTimeline(
    tripSummary.segments, smartStops, settings,
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
    projectedFuelStops: projectFuelStopsFromSimulation(smartStops),
    smartStops,
    roundTripMidpoint,
  };
}

/** Recalculate trip after changing a segment's stop type. Pure — no React state. */
export function orchestrateStopUpdate(
  localSummary: TripSummary,
  segmentIndex: number,
  newStopType: StopType,
  settings: TripSettings,
  vehicle: Vehicle,
  locations: Location[],
  roundTripMidpoint: number | undefined,
): StopUpdateResult {
  const updatedSegments = localSummary.segments.map((seg, idx) =>
    idx === segmentIndex ? { ...seg, stopType: newStopType } : seg
  );

  const segmentsWithTimes = calculateArrivalTimes(
    updatedSegments, settings.departureDate, settings.departureTime,
  );

  const updatedDays = splitTripByDays(
    segmentsWithTimes, settings,
    settings.departureDate, settings.departureTime,
    roundTripMidpoint, localSummary.fullGeometry,
  );

  const updatedCostBreakdown = updatedDays.length > 0
    ? calculateCostBreakdown(updatedDays, settings.numTravelers)
    : localSummary.costBreakdown;

  const updatedSummary: TripSummary = {
    ...localSummary,
    segments: segmentsWithTimes,
    days: updatedDays,
    costBreakdown: updatedCostBreakdown,
    budgetStatus: updatedCostBreakdown
      ? getBudgetStatus(settings.budget, updatedCostBreakdown)
      : localSummary.budgetStatus,
    budgetRemaining: updatedCostBreakdown
      ? settings.budget.total - updatedCostBreakdown.total
      : localSummary.budgetRemaining,
  };

  const refreshedSmartStops = generateSmartStops(
    segmentsWithTimes,
    createStopConfig(vehicle, settings, localSummary.fullGeometry, localSummary.segments[0]?.from.lng),
    updatedDays,
  );

  const destinationStayMinutes = getRoundTripDayTripStayMinutes(updatedSummary, updatedDays.length, settings);

  const refreshedTimeline = buildTimedTimeline(
    segmentsWithTimes, refreshedSmartStops, settings,
    roundTripMidpoint, destinationStayMinutes, updatedDays,
  );

  const canonicalTimeline = assembleCanonicalTimeline(
    applyComboOptimization(refreshedTimeline), updatedDays, updatedSummary,
    { locations: [...locations], vehicle, settings },
  );

  return {
    updatedSummary,
    canonicalTimeline,
    projectedFuelStops: projectFuelStopsFromSimulation(refreshedSmartStops),
  };
}

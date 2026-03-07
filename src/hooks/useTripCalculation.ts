import { useState, useCallback, useRef } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, TripDay, RouteStrategy } from '../types';
import { calculateRoute, fetchAllRouteStrategies } from '../lib/api';
import {
  calculateTripCosts,
  calculateArrivalTimes,
  type StrategicFuelStop,
} from '../lib/calculations';
import type { SuggestedStop } from '../lib/stop-suggestion-types';
import { snapFuelStopsToStations } from '../lib/fuel-stop-snapper';
import { buildRoundTripSegments, checkAndSetOvernightPrompt, fireAndForgetOvernightSnap } from '../lib/trip-calculation-helpers';
import {
  splitTripByDays,
  calculateCostBreakdown,
  getBudgetStatus,
} from '../lib/budget';
import { generateSmartStops, createStopConfig } from '../lib/stop-suggestions';
import { fetchWeather } from '../lib/weather';
import { addToHistory } from '../lib/storage';
import { serializeStateToURL } from '../lib/url';
import { validateTripInputs } from '../lib/validate-inputs';
import { buildStrategyUpdate } from '../lib/trip-strategy-selector';
import { buildTimedTimeline } from '../lib/trip-timeline';
import { applyComboOptimization } from '../lib/stop-consolidator';
import type { CanonicalTripTimeline, CanonicalTripDay } from '../lib/canonical-trip';
import { formatDateInZone } from '../lib/trip-timezone';

/**
 * Project simulation fuel stops onto the map pin shape.
 * The simulation engine (generateSmartStops) is the single source of truth —
 * these stops already carry lat/lng set in generate.ts so no separate geometry
 * calculation is needed. OSM station snapping runs on top of these projected pins.
 */
function projectFuelStopsFromSimulation(stops: SuggestedStop[]): StrategicFuelStop[] {
  return stops
    .filter(s => s.type === 'fuel' && !s.dismissed && s.lat != null && s.lng != null)
    .map(s => {
      const t = s.estimatedTime;
      const h = t.getHours();
      const m = t.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const timeStr = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
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

/**
 * Group flat canonical events into per-day buckets paired with budget metadata.
 * Each driving day's events span from its departure to the next day's departure.
 * Free days (no segments) get an empty event list.
 */
function assembleCanonicalTimeline(
  events: CanonicalTripTimeline['events'],
  tripDays: TripDay[],
  summary: TripSummary,
  inputs: CanonicalTripTimeline['inputs'],
): CanonicalTripTimeline {
  const days: CanonicalTripDay[] = tripDays.map(day => {
    if (day.segments.length === 0) return { meta: day, events: [] };
    const dep = events.find(
      e => e.type === 'departure' && formatDateInZone(e.arrivalTime, e.timezone ?? 'UTC') === day.date
    );
    if (!dep) return { meta: day, events: [] };
    const depMs = dep.arrivalTime.getTime();
    const nextDepMs = events.find(
      e => e.type === 'departure' && e.arrivalTime.getTime() > depMs
    )?.arrivalTime.getTime() ?? Infinity;
    return {
      meta: day,
      events: events.filter(
        e => e.arrivalTime.getTime() >= depMs && e.arrivalTime.getTime() < nextDepMs
      ),
    };
  });
  return { events, days, summary, inputs };
}

interface UseTripCalculationOptions {
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;
  onSummaryChange: (summary: TripSummary | null) => void;
  onCalculationComplete?: () => void;
}

interface UseTripCalculationReturn {
  // State
  isCalculating: boolean;
  error: string | null;
  shareUrl: string | null;
  strategicFuelStops: StrategicFuelStop[];
  canonicalTimeline: CanonicalTripTimeline | null;

  // Route strategies (named alternatives: fastest / canada-only / scenic)
  routeStrategies: RouteStrategy[];
  activeStrategyIndex: number;

  // Overnight Stop Prompt
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  dismissOvernightPrompt: () => void;

  // Actions
  calculateTrip: () => Promise<TripSummary | null>;
  selectStrategy: (index: number) => void;
  updateStopType: (segmentIndex: number, newStopType: import('../types').StopType) => void;
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: import('../types').DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: import('../types').OvernightStop) => void;
  clearError: () => void;
  clearTripCalculation: () => void;
}

export function useTripCalculation({
  locations,
  vehicle,
  settings,
  onSummaryChange,
  onCalculationComplete,
}: UseTripCalculationOptions): UseTripCalculationReturn {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [strategicFuelStops, setStrategicFuelStops] = useState<StrategicFuelStop[]>([]);
  const [routeStrategies, setRouteStrategies] = useState<RouteStrategy[]>([]);
  const [activeStrategyIndex, setActiveStrategyIndex] = useState(0);

  // Overnight stop prompt state
  const [showOvernightPrompt, setShowOvernightPrompt] = useState(false);
  const [suggestedOvernightStop, setSuggestedOvernightStop] = useState<Location | null>(null);

  // Store summary locally for updateStopType
  const [localSummary, setLocalSummary] = useState<TripSummary | null>(null);
  const [canonicalTimeline, setCanonicalTimeline] = useState<CanonicalTripTimeline | null>(null);

  // Abort controller for background overnight-stop geocoding.
  // Cancelled when a new calculation starts so stale results never overwrite.
  const geocodeAbortRef = useRef<AbortController | null>(null);

  // Retain roundTripMidpoint across calculations so updateStopType can re-split days correctly
  const roundTripMidpointRef = useRef<number | undefined>(undefined);

  const calculateTrip = useCallback(async (): Promise<TripSummary | null> => {
    setIsCalculating(true);
    setError(null);

    // Cancel any in-progress geocoding from a prior calculation.
    geocodeAbortRef.current?.abort();
    const geocodeController = new AbortController();
    geocodeAbortRef.current = geocodeController;

    try {
      const routeData = await calculateRoute(locations, {
        avoidTolls: settings.avoidTolls,
        avoidBorders: settings.avoidBorders,
        scenicMode: settings.scenicMode,
      });

      if (!routeData) {
        setError('Could not calculate route. Please check your locations.');
        return null;
      }

      // Validate inputs before any expensive calculation
      const validationErrors = validateTripInputs(routeData.segments, settings);
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return null;
      }

      // Calculate base trip costs
      const tripSummary = calculateTripCosts(routeData.segments, vehicle, settings);
      tripSummary.fullGeometry = routeData.fullGeometry;

      // Fetch weather for each segment — allSettled so one slow/failed request
      // doesn't block the whole pipeline; 5 s timeout per request.
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

      // Calculate arrival times for each segment
      let segmentsWithTimes = calculateArrivalTimes(
        segmentsWithWeather,
        settings.departureDate,
        settings.departureTime
      );

      // For round trips, duplicate and reverse segments, then recalculate
      let roundTripMidpoint: number | undefined;
      if (settings.isRoundTrip) {
        const rt = buildRoundTripSegments(segmentsWithTimes, tripSummary, settings, vehicle);
        segmentsWithTimes = rt.segments;
        roundTripMidpoint = rt.roundTripMidpoint;
        roundTripMidpointRef.current = roundTripMidpoint;
      }

      tripSummary.segments = segmentsWithTimes;
      tripSummary.roundTripMidpoint = roundTripMidpoint;

      // Split trip into days with budget tracking.
      // Note: fuelStops no longer passed here — the simulation (generateSmartStops below)
      // is now the single source of truth for both the itinerary and the map pins.
      const tripDays = splitTripByDays(
        segmentsWithTimes,
        settings,
        settings.departureDate,
        settings.departureTime,
        roundTripMidpoint,
        routeData.fullGeometry,
      );
      tripSummary.days = tripDays;

      // Calculate overall cost breakdown
      if (tripDays.length > 0) {
        tripSummary.costBreakdown = calculateCostBreakdown(tripDays, settings.numTravelers);
        tripSummary.budgetStatus = getBudgetStatus(settings.budget, tripSummary.costBreakdown);
        tripSummary.budgetRemaining = settings.budget.total - tripSummary.costBreakdown.total;

        // Ensure Summary perfectly matches the sum of its days
        tripSummary.totalFuelCost = tripSummary.costBreakdown.fuel;
        tripSummary.costPerPerson = settings.numTravelers > 0
          ? tripSummary.totalFuelCost / settings.numTravelers
          : tripSummary.totalFuelCost;
      }

      // Generate smart stops — drives BOTH the arrival time patch AND the map pins.
      // Replaces the separate calculateStrategicFuelStops call: the simulation engine
      // is the superset (hub-aware, simulation-state fuel tracking, regional costs,
      // timezone-aware, dismissable) so it should be the single source of truth.
      const smartStopsForPatch = generateSmartStops(
        tripSummary.segments,
        createStopConfig(vehicle, settings, tripSummary.fullGeometry),
        tripDays,
      );

      // Build canonical timed timeline — same engine the PDF and SmartTimeline use.
      // This is the SINGLE source of truth for departure/arrival times and route labels.
      // Replaces the old manual stop-duration patching which drifted from the simulation.
      const timedRaw = buildTimedTimeline(
        tripSummary.segments,
        smartStopsForPatch,
        settings,
        roundTripMidpoint,
        0,
        tripDays,
      );
      const canonicalEvents = applyComboOptimization(timedRaw);

      // Patch each driving day's totals from canonical events.
      //
      // Departure events always fire on the day's calendar date (day.date), so date
      // equality works for finding them. Arrival events for beast mode days may land
      // on a later calendar date (e.g. depart Mar 6, arrive Mar 8 after 41h).
      // Solution: date-match for departure; temporal-range for arrival (everything
      // between this departure and the next departure event in the list).
      for (const day of tripDays) {
        if (day.segments.length === 0) continue;

        const depEvent = canonicalEvents.find(
          e => e.type === 'departure' && formatDateInZone(e.arrivalTime, e.timezone ?? 'UTC') === day.date
        );

        let arrEvent: (typeof canonicalEvents)[0] | undefined;
        if (depEvent) {
          const depMs = depEvent.arrivalTime.getTime();
          // Find the first departure event that fires strictly after this one.
          const nextDepMs = canonicalEvents.find(
            e => e.type === 'departure' && e.arrivalTime.getTime() > depMs
          )?.arrivalTime.getTime() ?? Infinity;

          // Last overnight/arrival event in the window [this departure, next departure).
          arrEvent = canonicalEvents
            .filter(e =>
              (e.type === 'overnight' || e.type === 'arrival') &&
              e.arrivalTime.getTime() > depMs &&
              e.arrivalTime.getTime() <= nextDepMs
            )
            .at(-1);

          // Beast mode fallback: no overnight fires during a continuous drive, and
          // the trip-wide arrival event only fires at the end of the return leg.
          // The last waypoint in the window is the day-boundary event emitted at the
          // outbound destination, carrying the true wall-clock arrival time.
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

        // Overwrite departure/arrival with simulation truth.
        if (depEvent) day.totals.departureTime = depEvent.arrivalTime.toISOString();
        if (arrEvent) day.totals.arrivalTime = arrEvent.arrivalTime.toISOString();

        // Route label: departure event carries the hub-resolved overnight city.
        // Last segment TO cleaned of transit markers for the destination side.
        if (depEvent) {
          let toCity = day.segments.at(-1)?.to.name ?? '';
          toCity = toCity.replace(/\s*\(transit\)\s*$/, '');
          if (toCity.includes(' → ')) toCity = toCity.split(' → ').pop()!.trim();
          if (toCity) day.route = `${depEvent.locationHint} → ${toCity}`;
        }
      }

      // ── Assemble canonical trip timeline ──────────────────────────────
      setCanonicalTimeline(assembleCanonicalTimeline(
        canonicalEvents, tripDays, tripSummary,
        { locations: [...locations], vehicle, settings },
      ));

      // Project fuel stops from simulation onto the map.
      // Each SuggestedStop of type 'fuel' now carries lat/lng (set in generate.ts).
      // OSM station snapping runs on these projected pins — same fire-and-forget
      // pattern as before, just fed from the simulation instead of a separate algorithm.
      const projectedFuelStops = projectFuelStopsFromSimulation(smartStopsForPatch);
      setStrategicFuelStops(projectedFuelStops);
      snapFuelStopsToStations(projectedFuelStops).then(snapped => {
        setStrategicFuelStops(snapped);
      }).catch((err) => {
        console.warn('[fuel-snap] Overpass unavailable — keeping simulation-interpolated positions', err);
      });

      checkAndSetOvernightPrompt(
        tripSummary, tripDays, settings,
        setSuggestedOvernightStop, setShowOvernightPrompt,
      );

      // Add to history
      addToHistory(tripSummary);

      // Generate share URL
      serializeStateToURL(locations, vehicle, settings);
      setShareUrl(window.location.href);

      // Update state
      setLocalSummary(tripSummary);
      onSummaryChange(tripSummary);
      onCalculationComplete?.();

      // ── Fetch named route strategies in the background ─────────────────
      // Fire-and-forget: populates the strategy picker after the main result
      // is already displayed, so it never blocks the primary calculation.
      setRouteStrategies([]);
      setActiveStrategyIndex(0);
      fetchAllRouteStrategies(locations, settings.avoidTolls).then(strategies => {
        if (!geocodeController.signal.aborted) {
          setRouteStrategies(strategies);
        }
      });
      // ─────────────────────────────────────────────────────────────────

      // Fire-and-forget: snap overnight stop markers to nearest real town.
      fireAndForgetOvernightSnap(tripDays, tripSummary, geocodeController, setLocalSummary, onSummaryChange);
      // ─────────────────────────────────────────────────────────────────

      return tripSummary;
    } catch (e) {
      console.error(e);
      setError('An error occurred while calculating the route.');
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [locations, vehicle, settings, onSummaryChange, onCalculationComplete]);

  // Switch to a named route strategy — swaps geometry + recalculates fuel costs.
  // Day itinerary, weather, and POIs are preserved from the primary calculation.
  const selectStrategy = useCallback(
    (index: number) => {
      const strategy = routeStrategies[index];
      if (!strategy || !localSummary) return;
      setActiveStrategyIndex(index);
      setCanonicalTimeline(null); // Strategy swap: cleared until next full calculation
      const updatedSummary = buildStrategyUpdate(strategy, localSummary, vehicle, settings);
      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);
    },
    [routeStrategies, localSummary, vehicle, settings, onSummaryChange]
  );

  const updateStopType = useCallback(
    (segmentIndex: number, newStopType: import('../types').StopType) => {
      if (!localSummary) return;

      // Update the segment's stop type
      const updatedSegments = localSummary.segments.map((seg, idx) =>
        idx === segmentIndex ? { ...seg, stopType: newStopType } : seg
      );

      // Recalculate arrival times with new stop durations
      const segmentsWithTimes = calculateArrivalTimes(
        updatedSegments,
        settings.departureDate,
        settings.departureTime
      );

      // Re-split days so overnight markings update day budgets and structure
      const updatedDays = splitTripByDays(
        segmentsWithTimes,
        settings,
        settings.departureDate,
        settings.departureTime,
        roundTripMidpointRef.current,
        localSummary.fullGeometry as [number, number][],
      );

      const updatedCostBreakdown = updatedDays.length > 0
        ? calculateCostBreakdown(updatedDays, settings.numTravelers)
        : localSummary.costBreakdown;

      const updatedSummary = {
        ...localSummary,
        segments: segmentsWithTimes,
        days: updatedDays,
        costBreakdown: updatedCostBreakdown,
        budgetStatus: updatedCostBreakdown ? getBudgetStatus(settings.budget, updatedCostBreakdown) : localSummary.budgetStatus,
        budgetRemaining: updatedCostBreakdown ? settings.budget.total - updatedCostBreakdown.total : localSummary.budgetRemaining,
      };

      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);

      // Refresh map pins from simulation to reflect any changed overnight stops.
      const refreshedSmartStops = generateSmartStops(
        segmentsWithTimes,
        createStopConfig(vehicle, settings, localSummary.fullGeometry as number[][]),
        updatedDays,
      );
      const refreshedFuelStops = projectFuelStopsFromSimulation(refreshedSmartStops);
      setStrategicFuelStops(refreshedFuelStops);

      // Rebuild canonical timeline so it stays in sync with the updated stops.
      const refreshedTimeline = buildTimedTimeline(
        segmentsWithTimes, refreshedSmartStops, settings,
        roundTripMidpointRef.current, 0, updatedDays,
      );
      setCanonicalTimeline(assembleCanonicalTimeline(
        applyComboOptimization(refreshedTimeline), updatedDays, updatedSummary,
        { locations: [...locations], vehicle, settings },
      ));

      snapFuelStopsToStations(refreshedFuelStops).then(snapped => {
        setStrategicFuelStops(snapped);
      }).catch((err) => {
        console.warn('[fuel-snap] Overpass unavailable — keeping simulation-interpolated positions', err);
      });
    },
    [localSummary, settings, vehicle, locations, onSummaryChange]
  );

  // Generic day updater — updates a single day in summary.days
  const updateDay = useCallback(
    (dayNumber: number, patch: Partial<import('../types').TripDay>) => {
      if (!localSummary?.days) return;

      const updatedDays = localSummary.days.map(day =>
        day.dayNumber === dayNumber ? { ...day, ...patch } : day
      );

      const updatedSummary = {
        ...localSummary,
        days: updatedDays,
      };

      setLocalSummary(updatedSummary);
      onSummaryChange(updatedSummary);
    },
    [localSummary, onSummaryChange]
  );

  // Convenience wrappers
  const updateDayNotes = useCallback(
    (dayNumber: number, notes: string) => updateDay(dayNumber, { notes }),
    [updateDay]
  );

  const updateDayTitle = useCallback(
    (dayNumber: number, title: string) => updateDay(dayNumber, { title }),
    [updateDay]
  );

  const updateDayType = useCallback(
    (dayNumber: number, dayType: import('../types').DayType) => updateDay(dayNumber, { dayType }),
    [updateDay]
  );

  const updateDayOvernight = useCallback(
    (dayNumber: number, overnight: import('../types').OvernightStop) => updateDay(dayNumber, { overnight }),
    [updateDay]
  );

  const dismissOvernightPrompt = useCallback(() => {
    setShowOvernightPrompt(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearTripCalculation = useCallback(() => {
    setStrategicFuelStops([]);
    setRouteStrategies([]);
    setActiveStrategyIndex(0);
    setLocalSummary(null);
    setCanonicalTimeline(null);
    setShareUrl(null);
    setError(null);
    setShowOvernightPrompt(false);
    setSuggestedOvernightStop(null);
    onSummaryChange(null);
  }, [onSummaryChange]);

  return {
    isCalculating,
    error,
    shareUrl,
    strategicFuelStops,
    canonicalTimeline,
    routeStrategies,
    activeStrategyIndex,
    showOvernightPrompt,
    suggestedOvernightStop,
    dismissOvernightPrompt,
    calculateTrip,
    selectStrategy,
    updateStopType,
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
    clearError,
    clearTripCalculation,
  };
}

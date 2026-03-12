import type { RouteSegment, TripDay, ProcessedSegment } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { consolidateStops } from './consolidate';
import { TRIP_CONSTANTS } from '../trip-constants';
import { flattenDrivingSegments } from '../flatten-driving-segments';
import {
  handleDayBoundaryReset,
  checkArrivalWindow,
  checkFuelStop,
  checkRestBreak,
  checkMealStop,
  getEnRouteFuelStops,
  driveSegment,
  checkOvernightStop,
  applyTimezoneShift,
} from './stop-checks';
import { findPreferredHubInWindow } from '../hub-cache';
import { lngToIANA, ianaToAbbr } from '../trip-timezone';
import { getTimezoneShiftHours } from './timezone';
import { createStopPlanningRouteContext, prewarmWaypointHubs } from './route-context';

function createInitialState(config: StopSuggestionConfig, segments: RouteSegment[]): SimState {
  const stopFrequency = config.stopFrequency || 'balanced';
  return {
    currentFuel: config.tankSizeLitres,
    distanceSinceLastFill: 0,
    hoursSinceLastFill: 0,
    costSinceLastFill: 0,
    currentTime: new Date(config.departureTime),
    hoursOnRoad: 0,
    totalDrivingToday: 0,
    lastBreakTime: new Date(config.departureTime),
    currentDayNumber: 1,
    currentTzAbbr: segments[0]?.weather?.timezoneAbbr ?? null,
    restBreakInterval: TRIP_CONSTANTS.stops.restInterval[stopFrequency],
    comfortRefuelHours: TRIP_CONSTANTS.stops.comfortRefuel[stopFrequency],
  };
}

/**
 * Generate smart stop suggestions based on route, vehicle, and settings.
 */
export function generateSmartStops(
  segments: RouteSegment[],
  config: StopSuggestionConfig,
  days?: TripDay[],
): SuggestedStop[] {
  const { fullGeometry } = config;
  const stopFrequency = config.stopFrequency || 'balanced';

  const actualBuffer = TRIP_CONSTANTS.stops.buffers[stopFrequency];
  const vehicleRangeKm = (config.tankSizeLitres / config.fuelEconomyL100km) * 100;
  const safeRangeKm = vehicleRangeKm * (1 - actualBuffer);
  const routeContext = createStopPlanningRouteContext(segments, fullGeometry);

  const state = createInitialState(config, segments);
  const suggestions: SuggestedStop[] = [];
  prewarmWaypointHubs(segments);

  // Detect round trip (origin === final destination) for meal suppression at end
  const originName = segments[0]?.from.name;
  const destinationName = segments[segments.length - 1]?.to.name;
  const isRoundTrip = originName && destinationName && originName === destinationName;

  // Calculate total route distance for destination grace period.
  // Suppress fuel stops within GRACE_ZONE_KM of the final destination.
  const GRACE_ZONE_KM = 50;
  const { totalRouteDistanceKm } = routeContext;
  let cumulativeDistanceKm = 0;
  // For round trips: track whether the return-leg refuel reset has fired.
  // The sim assumes the car fills up at the destination before turning around.
  let returnLegFuelResetDone = false;

  // Build drivingDayStartMap keyed by FLAT processedSegment index (not _originalIndex).
  // Flat index is unique per sub-segment, so every driving-day boundary gets its own
  // reset and the simulation clock stays correct.
  // afterSegmentIndex in generated stops uses segment._originalIndex (segOrigIdx)
  // so trip-timeline.ts can match stops to segments.
  const { segments: flatList, dayBoundaries: drivingDayStartMap } = flattenDrivingSegments(segments, days);
  const simulationSegments: ProcessedSegment[] = flatList.map(f => f.seg);

  // Days where the user has already filled in hotel/overnight info.
  // Auto-generated overnight suggestions are suppressed for these days —
  // the user's explicit data takes precedence over the simulator's suggestion.
  const daysWithHotel = new Set<number>(
    days?.filter(d => d.overnight != null).map(d => d.dayNumber) ?? []
  );

  simulationSegments.forEach((segment, index) => {
    // segOrigIdx: index into the original `segments` array.
    // Used for afterSegmentIndex so trip-timeline.ts can match stops to route segments.
    // `index` (flat processedSegment position) is used only for drivingDayStartMap lookups.
    const segOrigIdx = segment._originalIndex;

    // Skip overnight and arrival-window checks for transit sub-segments not followed by a
    // real driving-day boundary. Covers two cases:
    // 1. Beast mode intermediates: sub-segs share a single driving day — skipping prevents
    //    currentDayNumber from incrementing for every ~8h sub-segment, which would corrupt
    //    dayNumber tags on en-route stops in the last sub-segment (dropped by classifyStops).
    // 2. Final transit sub-segment: no day boundary follows the destination — skipping
    //    prevents a spurious pre-destination overnight suggestion.
    const skipOvernightChecks = !!segment._transitPart && !drivingDayStartMap.has(index + 1);

    // When crossing a day boundary, synthesize an overnight stop from TripDay
    // overnight data if the auto-generator would have been suppressed by daysWithHotel.
    // This covers round-trip destinations where the outbound leg fits within
    // maxDriveHours so checkOvernightStop never fires, but a hotel stop was
    // still assigned by splitTripByDays.
    const incomingDay = drivingDayStartMap.get(index);
    if (incomingDay && days) {
      const prevDrivingDay = days
        .filter(d => d.segmentIndices.length > 0 && d.dayNumber < incomingDay.dayNumber)
        .at(-1);
      if (prevDrivingDay?.overnight && daysWithHotel.has(prevDrivingDay.dayNumber)) {
        const overnight = prevDrivingDay.overnight;
        suggestions.push({
          id: `overnight-midpoint-day${prevDrivingDay.dayNumber}`,
          type: 'overnight',
          reason: `Overnight at ${overnight.location.name}. Check in, rest up, and continue tomorrow.`,
          afterSegmentIndex: Math.max(0, segOrigIdx - 1),
          estimatedTime: new Date(state.currentTime),
          duration: 720,
          priority: 'required',
          details: { hoursOnRoad: state.totalDrivingToday },
          dayNumber: prevDrivingDay.dayNumber,
          accepted: true, // User already filled in hotel data — don't show as pending suggestion
          hubName: overnight.location.name,
        });
      }
    }

    // Day boundary reset (multi-day gap handling)
    handleDayBoundaryReset(state, index, drivingDayStartMap, config);

    // Arrival window check (pre-segment: would arriving too late?)
    // Note: checkArrivalWindow handles timezone shift internally via getTimezoneShiftHours,
    // so it correctly accounts for the crossing even before applyTimezoneShift fires below.
    const arrivalSug = skipOvernightChecks
      ? null
      : checkArrivalWindow(state, segment, index, config, daysWithHotel);
    if (arrivalSug) {
      arrivalSug.afterSegmentIndex += (segOrigIdx - index);
      // Overnight fires before this segment — current position is segment.from
      const fromHub = findPreferredHubInWindow(segment.from.lat, segment.from.lng, 40);
      if (fromHub) arrivalSug.hubName = fromHub.name;
      suggestions.push(arrivalSug);
    }

    // Apply timezone shift BEFORE fuel/rest/meal checks so stops are stamped in the
    // correct local time. Example: Winnipeg (CDT) → Regina (CST) segment
    // should stamp the fuel stop at 2:13 PM CST, not 3:13 PM CDT.
    //
    // Transit sub-segments (_transitPart) inherit their parent's DESTINATION
    // timezoneAbbr — which is WRONG for intermediate sub-segments. A Winnipeg→Vancouver
    // mega-segment split into 4 parts gives ALL parts timezoneAbbr='PDT'. We can't use
    // segment.weather.timezoneAbbr for these. Instead, derive the correct timezone from
    // the sub-segment's FROM longitude (which IS accurate — interpolated on the real road).
    if (segment._transitPart) {
      // Longitude-based timezone for transit sub-segments
      const derivedAbbr = ianaToAbbr(lngToIANA(segment.from.lng)) ?? state.currentTzAbbr;
      if (derivedAbbr && derivedAbbr !== state.currentTzAbbr) {
        const shiftMs = getTimezoneShiftHours(state.currentTzAbbr, derivedAbbr) * 3600000;
        state.currentTime = new Date(state.currentTime.getTime() + shiftMs);
        state.lastBreakTime = new Date(state.lastBreakTime.getTime() + shiftMs);
        state.currentTzAbbr = derivedAbbr;
      }
    } else {
      applyTimezoneShift(state, segment);
    }

    // Round-trip midpoint: reset fuel state to simulate the car refueling at the
    // destination before the return leg. cumulativeDistanceKm has NOT yet been
    // incremented for this segment, so the check fires on the first segment of
    // the return leg (the exact turnaround point). handleDayBoundaryReset already
    // does this when day-split data is perfect, but acts as a reliable fallback
    // when that path doesn't fire (transit sub-segments, missing day boundaries).
    if (isRoundTrip && !returnLegFuelResetDone && cumulativeDistanceKm >= totalRouteDistanceKm / 2) {
      state.currentFuel = config.tankSizeLitres;
      state.distanceSinceLastFill = 0;
      state.hoursSinceLastFill = 0;
      state.costSinceLastFill = 0;
      returnLegFuelResetDone = true;
    }

    // Accumulate distance/hours for fuel check
    state.distanceSinceLastFill += segment.distanceKm;
    state.hoursSinceLastFill += segment.durationMinutes / 60;
    cumulativeDistanceKm += segment.distanceKm;

    // Destination grace period: suppress fuel stops within 50km of final destination.
    // This prevents the "destination panic" duplicate-fill bug caused by multiple
    // short segments near the destination each triggering their own fuel check.
    const isFinalSegment = segOrigIdx === segments.length - 1 && index === simulationSegments.length - 1;
    const remainingDistanceKm = totalRouteDistanceKm - cumulativeDistanceKm;
    const inDestinationGraceZone = remainingDistanceKm < GRACE_ZONE_KM;

    // Hub-aware fuel stop placement.
    // NOTE: cumulativeDistanceKm already includes this segment's distance.
    // For per-stop hub lookups inside getEnRouteFuelStops, we pass segmentStartKm
    // so each stop can interpolate its own position on the full route geometry.
    const segmentStartKm = cumulativeDistanceKm - segment.distanceKm;

    // Fuel needs for the coming segment — used for endpoint deferral safety check.
    const segFuelNeeded = segment.fuelNeededLitres
      ?? (segment.distanceKm / 100) * config.fuelEconomyL100km;
    const wouldRunCriticallyLow =
      (state.currentFuel - segFuelNeeded) < (config.tankSizeLitres * TRIP_CONSTANTS.fuelLevels.critical);

    // Hub lookup — priority order:
    // 1. segment.from (the actual stop location for inter-segment stops, index > 0).
    //    checkFuelStop places the stop at afterSegmentIndex = index - 1, which is
    //    physically at segment.from. Checking here first gives correct city labels
    //    on city-to-city routes (e.g. "Fuel up in Kenora, ON" not an unnamed midpoint).
    // 2. Route midpoint fallback — for safety stops on segment 0, or when segment.from
    //    has no hub (sparse stretches between seeded cities).
    let hubName: string | undefined;
    if (index > 0) {
      const fromHub = findPreferredHubInWindow(segment.from.lat, segment.from.lng, 40);
      if (fromHub) hubName = fromHub.name;
    }
    if (!hubName && fullGeometry && fullGeometry.length > 1) {
      const pos = routeContext.getGeometryPosition(segmentStartKm + segment.distanceKm * 0.5);
      if (pos) {
        const hub = findPreferredHubInWindow(pos.lat, pos.lng);
        if (hub) hubName = hub.name;
      }
    }

    // Endpoint deferral: segment.from has no hub, but segment.to is a real city
    // we can safely reach. Suppress the stop here — the next iteration fires with
    // segment.from = this segment.to = the hub, and it gets correctly labeled.
    // wouldRunCriticallyLow guard: critical stops always fire immediately.
    const endpointHub = (!hubName && !wouldRunCriticallyLow && !inDestinationGraceZone && index > 0)
      ? findPreferredHubInWindow(segment.to.lat, segment.to.lng, 40)
      : null;

    // Fuel stop check
    const { suggestion: fuelSug, stopTimeAddedMs } = endpointHub
      ? { suggestion: null, stopTimeAddedMs: 0 }
      : checkFuelStop(state, segment, index, config, safeRangeKm, inDestinationGraceZone, hubName);
    if (fuelSug) {
      fuelSug.afterSegmentIndex += (segOrigIdx - index);
      // Attach geographic coordinates for map pin projection.
      // inter-segment stops (index > 0) fire at segment.from — use exact coords.
      // Segment-0 stops (no previous segment junction) interpolate from geometry.
      fuelSug.distanceFromStart = segmentStartKm;
      if (index > 0) {
        fuelSug.lat = segment.from.lat;
        fuelSug.lng = segment.from.lng;
      } else if (fullGeometry && fullGeometry.length > 1) {
        const pos = routeContext.getGeometryPosition(segmentStartKm);
        if (pos) { fuelSug.lat = pos.lat; fuelSug.lng = pos.lng; }
      }
      suggestions.push(fuelSug);
    }

    // Rest break check
    const fuelFraction = state.currentFuel / config.tankSizeLitres;
    const restSug = checkRestBreak(state, segment, index, config, stopTimeAddedMs, fuelFraction);
    if (restSug) {
      restSug.afterSegmentIndex += (segOrigIdx - index);
      suggestions.push(restSug);
    }

    // Save current time for meal/en-route calculations (after stop delays)
    const segmentStartTime = new Date(state.currentTime);

    // Meal stop check — skip on final segment of round trip (arriving home)
    const isArrivingHome = !!(isFinalSegment && isRoundTrip);
    const mealSug = checkMealStop(state, segment, index, segmentStartTime, isArrivingHome);

    // Skip meal suggestion if there's a recent fuel stop within ~2h — user can combo there.
    // This prevents suggesting a meal in "Unorganized Kenora District" when they just
    // filled up at Dryden and can eat there instead.
    if (mealSug) {
      mealSug.afterSegmentIndex += (segOrigIdx - index);
      const mealTime = mealSug.estimatedTime?.getTime() ?? 0;
      const COMBO_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
      const hasRecentFuelStop = suggestions.some(s =>
        s.type === 'fuel' &&
        s.estimatedTime &&
        Math.abs(s.estimatedTime.getTime() - mealTime) < COMBO_WINDOW_MS
      );
      if (!hasRecentFuelStop) {
        suggestions.push(mealSug);
      }
    }

    // En-route fuel stops (for very long legs).
    // Build a resolver so each stop gets its own hub name from its actual route position.
    const enRouteHubResolver = (fullGeometry && fullGeometry.length > 1)
      ? (kmIntoSegment: number): string | undefined => routeContext.getHubNameAtKm(segmentStartKm + kmIntoSegment)
      : undefined;
    const distBeforeSegment = (state.distanceSinceLastFill - segment.distanceKm);
    const enRoutePositionResolver = (fullGeometry && fullGeometry.length > 1)
      ? (kmIntoSegment: number) => {
          return routeContext.getGeometryPosition(segmentStartKm + kmIntoSegment);
        }
      : undefined;
    const { stops: enRouteStops, lastFillKm } = getEnRouteFuelStops(
      state, segment, index, config, safeRangeKm, segmentStartTime,
      Math.max(0, distBeforeSegment), enRouteHubResolver,
      state.comfortRefuelHours, enRoutePositionResolver, segmentStartKm
    );
    enRouteStops.forEach(s => { s.afterSegmentIndex += (segOrigIdx - index); });
    suggestions.push(...enRouteStops);

    // Drive the segment
    const arrivalTime = driveSegment(state, segment, segmentStartTime, config);

    // Sync simulation state for mid-segment en-route fills.
    // driveSegment consumes fuel for the full segment, but the tank was refilled
    // at lastFillKm — correct distanceSinceLastFill, hoursSinceLastFill, and
    // currentFuel to reflect only the distance driven AFTER the last en-route fill.
    // This prevents checkFuelStop from firing spuriously at the next segment boundary.
    if (lastFillKm > 0) {
      const remainingKm  = segment.distanceKm - lastFillKm;
      const remainingMin = (remainingKm / segment.distanceKm) * segment.durationMinutes;
      const remainingFuel = (remainingKm / 100) * config.fuelEconomyL100km;
      state.currentFuel          = config.tankSizeLitres - remainingFuel;
      state.distanceSinceLastFill = remainingKm;
      state.hoursSinceLastFill    = remainingMin / 60;
      // Cost of the remaining portion after the last en-route fill (regional prices)
      state.costSinceLastFill = (remainingKm / segment.distanceKm) * (segment.fuelCost ?? 0);
    } else {
      // No en-route fill — accumulate the entire segment's cost
      state.costSinceLastFill += segment.fuelCost ?? 0;
    }

    // Intent-aware state reset: when the user declared a fuel/meal intent at this
    // waypoint (segment.to), adjust sim state as if the planned stop happened.
    // This prevents the NEXT segment's boundary check from firing a redundant fuel
    // or meal stop near the same waypoint. The orchestrator injects the actual intent
    // stop into the output — here we just sync the simulation state.
    const waypointIntent = segment.to?.intent;
    if (waypointIntent && segment.to?.type === 'waypoint') {
      if (waypointIntent.fuel) {
        state.currentFuel = config.tankSizeLitres;
        state.distanceSinceLastFill = 0;
        state.hoursSinceLastFill = 0;
        state.costSinceLastFill = 0;
        const dwellMs = (waypointIntent.dwellMinutes ?? (waypointIntent.meal ? 45 : 15)) * 60 * 1000;
        state.currentTime = new Date(state.currentTime.getTime() + dwellMs);
        state.lastBreakTime = new Date(state.currentTime);
      } else if (waypointIntent.meal) {
        const dwellMs = (waypointIntent.dwellMinutes ?? 45) * 60 * 1000;
        state.currentTime = new Date(state.currentTime.getTime() + dwellMs);
        state.lastBreakTime = new Date(state.currentTime);
      }
    }

    // Overnight stop check (uses strict "final segment" check, not grace zone).
    // Skipped for transit sub-segments without a following day boundary — beast mode
    // internal splits and the final destination arrival. Skipping preserves
    // currentDayNumber so en-route stop dayNumber tags stay correct.
    if (skipOvernightChecks) {
      state.currentTime = arrivalTime;
    } else {
      const overnightSug = checkOvernightStop(
        state, index, config, daysWithHotel, arrivalTime, isFinalSegment
      );
      if (overnightSug) {
        overnightSug.afterSegmentIndex += (segOrigIdx - index);
        // Overnight fires after driving this segment — current position is segment.to
        const toHub = findPreferredHubInWindow(segment.to.lat, segment.to.lng, 40);
        if (toHub) overnightSug.hubName = toHub.name;
        suggestions.push(overnightSug);
      }
    }
  });

  return consolidateStops(suggestions);
}

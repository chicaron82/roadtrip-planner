import type { RouteSegment, TripDay } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { consolidateStops } from './consolidate';
import { TRIP_CONSTANTS } from '../trip-constants';
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
import { findHubInWindow } from '../hub-cache';
import { interpolateRoutePosition } from '../route-geocoder';

function createInitialState(config: StopSuggestionConfig, segments: RouteSegment[]): SimState {
  const stopFrequency = config.stopFrequency || 'balanced';
  return {
    currentFuel: config.tankSizeLitres,
    distanceSinceLastFill: 0,
    hoursSinceLastFill: 0,
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
 *
 * @param segments - Route segments from OSRM
 * @param config - Vehicle and preference configuration (includes fullGeometry for hub-aware placement)
 * @param days - Optional trip day structure for multi-day trips
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

  const state = createInitialState(config, segments);
  const suggestions: SuggestedStop[] = [];

  // Detect round trip (origin === final destination) for meal suppression at end
  const originName = segments[0]?.from.name;
  const destinationName = segments[segments.length - 1]?.to.name;
  const isRoundTrip = originName && destinationName && originName === destinationName;

  // Calculate total route distance for destination grace period.
  // Suppress fuel stops within GRACE_ZONE_KM of the final destination.
  const GRACE_ZONE_KM = 50;
  const totalRouteDistanceKm = segments.reduce((sum, seg) => sum + seg.distanceKm, 0);
  let cumulativeDistanceKm = 0;

  // Build drivingDayStartMap keyed by FLAT processedSegment index (not _originalIndex).
  //
  // When splitLongSegments splits a 2300km segment into 4 sub-segments, all sub-segments
  // share the same _originalIndex (e.g. 0). Days 2, 3, and 4 all have segmentIndices[0]=0,
  // so keying by _originalIndex causes later days to overwrite earlier ones — only the
  // last day's clock reset fires. Flat index is unique per sub-segment, so every
  // driving-day boundary gets its own reset and the simulation clock stays correct.
  //
  // afterSegmentIndex in generated stops still uses segment._originalIndex (segOrigIdx)
  // so trip-timeline.ts (which iterates original segments) can match stops to segments.
  type SimSegment = RouteSegment & {
    _originalIndex: number;
    // Populated by splitLongSegments when a segment was split into sub-parts.
    // Sub-segments inherit their parent's destination timezoneAbbr — which is
    // wrong for sub-segments covering earlier parts of the route. We use this
    // flag to skip applyTimezoneShift for split sub-segments.
    _transitPart?: { index: number; total: number };
  };
  let simulationSegments: SimSegment[];
  const drivingDayStartMap = new Map<number, TripDay>();

  if (days) {
    const drivingDays = days.filter(d => d.segmentIndices.length > 0);
    simulationSegments = drivingDays.flatMap(d => d.segments as SimSegment[]);
    let flatIdx = 0;
    drivingDays.forEach((day, i) => {
      if (i > 0) drivingDayStartMap.set(flatIdx, day);
      flatIdx += day.segments.length;
    });
  } else {
    simulationSegments = segments.map((s, i) => ({ ...s, _originalIndex: i }));
  }

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
        });
      }
    }

    // Day boundary reset (multi-day gap handling)
    handleDayBoundaryReset(state, index, drivingDayStartMap, config);

    // Arrival window check (pre-segment: would arriving too late?)
    // Note: checkArrivalWindow handles timezone shift internally via getTimezoneShiftHours,
    // so it correctly accounts for the crossing even before applyTimezoneShift fires below.
    const arrivalSug = checkArrivalWindow(state, segment, index, config, daysWithHotel);
    if (arrivalSug) {
      arrivalSug.afterSegmentIndex += (segOrigIdx - index);
      suggestions.push(arrivalSug);
    }

    // Apply timezone shift BEFORE fuel/rest/meal checks so stops are stamped in the
    // correct local time (Bug B fix). Example: Winnipeg (CDT) → Regina (CST) segment
    // should stamp the fuel stop at 2:13 PM CST, not 3:13 PM CDT.
    //
    // Guard: split sub-segments (_transitPart is set) inherit their parent's DESTINATION
    // timezoneAbbr. A Winnipeg→Vancouver mega-segment split into 4 parts gives ALL parts
    // timezoneAbbr='PDT' — applying PDT on Day 1 (still in Manitoba, CDT) shifts the clock
    // back 2h and corrupts all stop times. Only apply the shift for non-split segments
    // where timezoneAbbr accurately reflects that segment's own destination timezone.
    if (!segment._transitPart) {
      applyTimezoneShift(state, segment);
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

    // Hub-aware fuel stop placement:
    // When a fuel stop is due, check if a known hub falls within the snap window.
    // If yes: label the stop with the hub name ("Fuel up in Fargo, ND").
    // If no: fall through to standard tank-math behavior.
    //
    // NOTE: cumulativeDistanceKm already includes this segment's distance.
    // For per-stop hub lookups inside getEnRouteFuelStops, we pass segmentStartKm
    // so each stop can interpolate its own position on the full route geometry.
    const segmentStartKm = cumulativeDistanceKm - segment.distanceKm;
    let hubName: string | undefined;
    if (fullGeometry && fullGeometry.length > 1) {
      const pos = interpolateRoutePosition(fullGeometry, segmentStartKm + segment.distanceKm * 0.5);
      if (pos) {
        const hub = findHubInWindow(pos.lat, pos.lng);
        if (hub) {
          hubName = hub.name;
        }
      }
    }

    // Fuel stop check
    const { suggestion: fuelSug, stopTimeAddedMs } = checkFuelStop(
      state, segment, index, config, safeRangeKm, inDestinationGraceZone, hubName
    );
    if (fuelSug) {
      fuelSug.afterSegmentIndex += (segOrigIdx - index);
      suggestions.push(fuelSug);
    }

    // Rest break check
    const restSug = checkRestBreak(state, segment, index, config, stopTimeAddedMs);
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
      ? (kmIntoSegment: number): string | undefined => {
          const pos = interpolateRoutePosition(fullGeometry!, segmentStartKm + kmIntoSegment);
          if (!pos) return undefined;
          const hub = findHubInWindow(pos.lat, pos.lng);
          return hub?.name;
        }
      : undefined;
    const distBeforeSegment = (state.distanceSinceLastFill - segment.distanceKm);
    const { stops: enRouteStops, lastFillKm } = getEnRouteFuelStops(
      state, segment, index, config, safeRangeKm, segmentStartTime,
      Math.max(0, distBeforeSegment), enRouteHubResolver,
      state.comfortRefuelHours
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
    }

    // Overnight stop check (uses strict "final segment" check, not grace zone)
    const overnightSug = checkOvernightStop(
      state, index, config, daysWithHotel, arrivalTime, isFinalSegment
    );
    if (overnightSug) {
      overnightSug.afterSegmentIndex += (segOrigIdx - index);
      suggestions.push(overnightSug);
    }
  });

  return consolidateStops(suggestions);
}

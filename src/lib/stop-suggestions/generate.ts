import type { RouteSegment, TripDay } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { consolidateStops } from './consolidate';
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
    restBreakInterval: stopFrequency === 'conservative' ? 1.5 : stopFrequency === 'balanced' ? 2 : 2.5,
    comfortRefuelHours: stopFrequency === 'conservative' ? 2.5 : stopFrequency === 'balanced' ? 3.5 : 4.5,
  };
}

/**
 * Generate smart stop suggestions based on route, vehicle, and settings
 */
export function generateSmartStops(
  segments: RouteSegment[],
  config: StopSuggestionConfig,
  days?: TripDay[]
): SuggestedStop[] {
  const stopFrequency = config.stopFrequency || 'balanced';

  const bufferMultipliers = { conservative: 0.30, balanced: 0.25, aggressive: 0.20 };
  const actualBuffer = bufferMultipliers[stopFrequency];
  const vehicleRangeKm = (config.tankSizeLitres / config.fuelEconomyL100km) * 100;
  const safeRangeKm = vehicleRangeKm * (1 - actualBuffer);

  const state = createInitialState(config, segments);
  const suggestions: SuggestedStop[] = [];

  // Build map: first-segment-index → TripDay, for non-first driving days only.
  // Used to reset simulation state at multi-day boundaries (e.g., after a free day).
  const drivingDayStartMap = new Map<number, TripDay>();
  if (days) {
    const drivingDays = days.filter(d => d.segmentIndices.length > 0);
    drivingDays.slice(1).forEach(day => {
      if (day.segmentIndices.length > 0) {
        drivingDayStartMap.set(day.segmentIndices[0], day);
      }
    });
  }

  // Days where the user has already filled in hotel/overnight info.
  // Auto-generated overnight suggestions are suppressed for these days —
  // the user's explicit data takes precedence over the simulator's suggestion.
  const daysWithHotel = new Set<number>(
    days?.filter(d => d.overnight != null).map(d => d.dayNumber) ?? []
  );

  segments.forEach((segment, index) => {
    // Day boundary reset (multi-day gap handling)
    handleDayBoundaryReset(state, index, drivingDayStartMap, config);

    // Arrival window check (pre-segment: would arriving too late?)
    const arrivalSug = checkArrivalWindow(state, segment, index, config, daysWithHotel);
    if (arrivalSug) suggestions.push(arrivalSug);

    // Accumulate distance/hours for fuel check
    state.distanceSinceLastFill += segment.distanceKm;
    state.hoursSinceLastFill += segment.durationMinutes / 60;

    // Fuel stop check
    const { suggestion: fuelSug, stopTimeAddedMs } = checkFuelStop(state, segment, index, config, safeRangeKm);
    if (fuelSug) suggestions.push(fuelSug);

    // Rest break check
    const restSug = checkRestBreak(state, segment, index, config, stopTimeAddedMs);
    if (restSug) suggestions.push(restSug);

    // Save current time for meal/en-route calculations (after stop delays)
    const segmentStartTime = new Date(state.currentTime);

    // Meal stop check
    const mealSug = checkMealStop(state, segment, index, segmentStartTime);
    if (mealSug) suggestions.push(mealSug);

    // En-route fuel stops (for very long legs)
    suggestions.push(...getEnRouteFuelStops(state, segment, index, config, safeRangeKm, segmentStartTime));

    // Drive the segment
    const arrivalTime = driveSegment(state, segment, segmentStartTime, config);

    // Overnight stop check
    const overnightSug = checkOvernightStop(
      state, index, config, daysWithHotel, arrivalTime, index === segments.length - 1
    );
    if (overnightSug) suggestions.push(overnightSug);

    // Timezone crossing adjustment
    applyTimezoneShift(state, segment);
  });

  return consolidateStops(suggestions);
}

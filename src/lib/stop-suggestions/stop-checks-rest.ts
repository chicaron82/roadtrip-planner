/**
 * stop-checks-rest.ts — Rest break and meal stop logic.
 *
 * Contains: checkRestBreak, checkMealStop
 */

import type { RouteSegment } from '../../types';
import type { SuggestedStop, StopSuggestionConfig } from '../stop-suggestion-types';
import type { SimState } from './types';
import { getTimezoneShiftHours } from './timezone';

const MEAL_TIMES = { breakfast: 8, lunch: 12, dinner: 18 }; // 24h format

/**
 * Check if a rest break is due.
 * stopTimeAddedMs: time already advanced this iteration by a fuel stop.
 * consolidateStops merges adjacent stops, so don't double-count fuel + rest.
 */
export function checkRestBreak(
  state: SimState,
  segment: RouteSegment,
  index: number,
  config: StopSuggestionConfig,
  stopTimeAddedMs: number,
): SuggestedStop | null {
  const hoursSinceBreak = (state.currentTime.getTime() - state.lastBreakTime.getTime()) / (1000 * 60 * 60);
  if (hoursSinceBreak < state.restBreakInterval || segment.durationMinutes <= 30) return null;

  const numDriversText = config.numDrivers > 1 ? `${config.numDrivers} drivers` : 'solo driver';

  state.lastBreakTime = new Date(state.currentTime);
  const restMs = 15 * 60 * 1000;
  const remainingMs = Math.max(0, restMs - stopTimeAddedMs);
  if (remainingMs > 0) {
    state.currentTime = new Date(state.currentTime.getTime() + remainingMs);
  }

  return {
    id: `rest-${index}`,
    type: 'rest',
    reason: `${hoursSinceBreak.toFixed(1)} hours behind the wheel (${numDriversText}). Take a 15-minute break to stretch, use the restroom, and stay alert.`,
    afterSegmentIndex: index - 1,
    estimatedTime: new Date(state.lastBreakTime),
    duration: 15,
    priority: 'recommended',
    details: { hoursOnRoad: state.hoursOnRoad },
    dayNumber: state.currentDayNumber,
  };
}

/**
 * Check if a meal stop (lunch or dinner) falls within this segment.
 * segmentStartTime is the captured currentTime before driving begins.
 *
 * @param isArrivingHome - If true, skip meal suggestion (arriving home on round trip)
 */
export function checkMealStop(
  state: SimState,
  segment: RouteSegment,
  index: number,
  segmentStartTime: Date,
  isArrivingHome = false,
): SuggestedStop | null {
  if (isArrivingHome) return null;

  const segmentEndMs = segmentStartTime.getTime() + segment.durationMinutes * 60 * 1000;

  // For timezone crossings, check meal windows in both timezones.
  const tzShift = getTimezoneShiftHours(state.currentTzAbbr, segment.weather?.timezoneAbbr ?? null);

  const mealTimestampForHour = (hour: number, offsetHours = 0): Date => {
    const t = new Date(segmentStartTime);
    t.setHours(hour + offsetHours, 0, 0, 0);
    return t;
  };

  const lunchTs = mealTimestampForHour(MEAL_TIMES.lunch);
  const dinnerTs = mealTimestampForHour(MEAL_TIMES.dinner);

  const lunchTsDest = tzShift !== 0 ? mealTimestampForHour(MEAL_TIMES.lunch, -tzShift) : lunchTs;
  const dinnerTsDest = tzShift !== 0 ? mealTimestampForHour(MEAL_TIMES.dinner, -tzShift) : dinnerTs;

  const crossesWindow = (ts: Date) =>
    ts.getTime() > segmentStartTime.getTime() && ts.getTime() <= segmentEndMs;

  const crossesLunch = crossesWindow(lunchTs) || crossesWindow(lunchTsDest);
  const crossesDinner = crossesWindow(dinnerTs) || crossesWindow(dinnerTsDest);

  if (!crossesLunch && !crossesDinner) return null;

  const mealType = crossesLunch ? 'Lunch' : 'Dinner';
  const mealTime = crossesLunch ? '12:00 PM' : '6:00 PM';
  const mealTs = crossesLunch ? lunchTs : dinnerTs;

  const hoursUntilMeal = (mealTs.getTime() - segmentStartTime.getTime()) / (1000 * 60 * 60);
  const hoursOnRoadAtMeal = (state.hoursOnRoad + hoursUntilMeal).toFixed(1);

  return {
    id: `meal-${mealType.toLowerCase()}-${index}`,
    type: 'meal',
    reason: `${mealType} break around ${mealTime}. You'll have driven ${hoursOnRoadAtMeal} hours. Refuel yourself and your vehicle with a proper meal.`,
    afterSegmentIndex: index,
    estimatedTime: crossesLunch ? new Date(lunchTs) : new Date(dinnerTs),
    duration: 45,
    priority: 'optional',
    details: { hoursOnRoad: state.hoursOnRoad + hoursUntilMeal },
    dayNumber: state.currentDayNumber,
  };
}

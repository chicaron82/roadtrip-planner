/**
 * stop-consolidator.ts — Combo stop optimizer
 *
 * Core insight: a FLEXIBLE stop (meal, rest) within a proximity window of a
 * MANDATORY stop (fuel) should be merged at the mandatory stop's location.
 *
 * "If lunch is at 12 and fuel is needed at 1pm near Dryden —
 *  do both at Dryden. 45 min total, not 1h 30min."
 *
 * Algorithm:
 *   For each fuel event: scan forward up to FLEX_WINDOW_MINUTES for meal/rest events.
 *   If found: remove the meal from its original position, merge into the fuel event.
 *   timeSaved = (fuel.duration + meal.duration) - combo.duration
 *             + drive_minutes_between (time saved skipping to the meal stop)
 *
 * 💚 My Experience Engine
 */

import { type TimedEvent } from './trip-timeline';

/** Maximum minutes between a fuel stop and a flexible stop for combo eligibility. */
const FLEX_WINDOW_MINUTES = 90;

/** Combined duration for a fuel+meal combo (eat while car fuels/parks — parallel). */
const COMBO_FUEL_MEAL_MINUTES = 45;
const COMBO_FUEL_REST_MINUTES = 20;

type ComboableType = 'meal' | 'rest';

const isFlexible = (e: TimedEvent): e is TimedEvent & { type: ComboableType } =>
  e.type === 'meal' || e.type === 'rest';

const isFuel = (e: TimedEvent): boolean => e.type === 'fuel';

/**
 * Scans `events` for fuel+flexible pairs within the time window and merges them.
 * Returns a new event array — never mutates the input.
 */
export function applyComboOptimization(
  events: TimedEvent[],
  flexWindowMinutes: number = FLEX_WINDOW_MINUTES,
): TimedEvent[] {
  // Work on a copy; track which indices have been merged away
  const result: TimedEvent[] = [...events];
  const consumed = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    if (consumed.has(i)) continue;
    const fuelEvent = result[i];
    if (!isFuel(fuelEvent)) continue;

    // Scan forward for the nearest eligible flexible stop within the window
    let flexIdx = -1;
    for (let j = i + 1; j < result.length; j++) {
      if (consumed.has(j)) continue;
      const candidate = result[j];
      if (!isFlexible(candidate)) continue;

      const gapMinutes =
        (candidate.arrivalTime.getTime() - fuelEvent.departureTime.getTime()) / 60000;

      if (gapMinutes < 0) continue; // already behind us
      if (gapMinutes > flexWindowMinutes) break; // beyond window

      flexIdx = j;
      break;
    }

    if (flexIdx === -1) continue;

    const flexEvent = result[flexIdx];
    const flexType = flexEvent.type as ComboableType;

    // Time that would have been spent if kept separate:
    //   fuel stop + drive to flex stop + flex stop
    const driveMinutesBetween = Math.round(
      (flexEvent.arrivalTime.getTime() - fuelEvent.departureTime.getTime()) / 60000
    );
    const separateTotalMinutes = fuelEvent.durationMinutes + driveMinutesBetween + flexEvent.durationMinutes;

    const comboDuration = flexType === 'meal' ? COMBO_FUEL_MEAL_MINUTES : COMBO_FUEL_REST_MINUTES;
    const timeSaved = Math.max(0, separateTotalMinutes - comboDuration);

    // Build combo label
    const comboLabel =
      flexType === 'meal' ? buildMealLabel(flexEvent, fuelEvent.arrivalTime) :
      flexType === 'rest' ? 'Fuel + Break' :
      'Fuel + Stop';

    // Build merged event at the fuel stop's location/time
    const comboDep = new Date(fuelEvent.arrivalTime.getTime() + comboDuration * 60 * 1000);
    const merged: TimedEvent = {
      id: `combo-${fuelEvent.id}-${flexEvent.id}`,
      type: 'combo',
      arrivalTime: new Date(fuelEvent.arrivalTime),
      departureTime: comboDep,
      durationMinutes: comboDuration,
      distanceFromOriginKm: fuelEvent.distanceFromOriginKm,
      locationHint: fuelEvent.locationHint,
      stops: [...fuelEvent.stops, ...flexEvent.stops],
      timeSavedMinutes: timeSaved,
      comboLabel,
    };

    // Replace fuel event with combo; mark flex event as consumed
    result[i] = merged;
    consumed.add(flexIdx);

    // Rebuild arrival times for events that come AFTER the flex event,
    // since we're removing it (shortening the timeline by driveMinutesBetween + flexEvent.duration - 0).
    // The combo is already at the fuel stop's time so no extra time needed.
    const timeRecoveredMs =
      (driveMinutesBetween + flexEvent.durationMinutes - 0) * 60 * 1000;

    for (let k = flexIdx + 1; k < result.length; k++) {
      if (consumed.has(k)) continue;
      result[k] = {
        ...result[k],
        arrivalTime: new Date(result[k].arrivalTime.getTime() - timeRecoveredMs),
        departureTime: new Date(result[k].departureTime.getTime() - timeRecoveredMs),
      };
    }
  }

  return result.filter((_, i) => !consumed.has(i));
}

/**
 * Determine meal name using clock time at the combo stop, falling back to
 * the stop's reason text if the hour is ambiguous.
 */
function buildMealLabel(flexEvent: TimedEvent, comboArrival: Date): string {
  const hour = comboArrival.getHours();
  // Time-aware first: breakfast < 10:30, dinner >= 17:00, otherwise lunch
  const timeMeal =
    hour < 10 || (hour === 10 && comboArrival.getMinutes() < 30) ? 'Breakfast' :
    hour >= 17 ? 'Dinner' :
    'Lunch';

  // Let the stop reason override if it has a more specific label
  const reason = flexEvent.stops[0]?.reason ?? '';
  const reasonLower = reason.toLowerCase();
  const reasonMeal =
    reasonLower.includes('breakfast') ? 'Breakfast' :
    reasonLower.includes('dinner')    ? 'Dinner'    :
    reasonLower.includes('lunch')     ? 'Lunch'     :
    null;

  // Prefer time-aware over reason text (reason was computed at planning time,
  // not at actual clock time after the drive).
  return `Fuel + ${timeMeal || reasonMeal || 'Meal'}`;
}

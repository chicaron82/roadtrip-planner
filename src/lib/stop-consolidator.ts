/**
 * stop-consolidator.ts — Combo stop optimizer
 *
 * Two merger patterns:
 *
 * 1. FUEL → nearby MEAL/REST (original) — classic combo.
 *    "Fuel at 1pm, lunch at 1:30pm → Fuel + Lunch at 1pm."
 *
 * 2. MEAL → nearby FUEL (new) — meal absorbs fuel.
 *    "Lunch at 12pm, fuel at 4:52pm → Fuel + Lunch at 12pm."
 *    You're already parked 45 min eating. Fill up while you eat.
 *    Eliminates a separate fuel stop hours later.
 *
 * For pattern 2 we use a larger window (MEAL_ABSORB_FUEL_WINDOW)
 * because a meal at 12 PM that prevents a fuel stop at 5 PM is a
 * net win: you would have needed fuel eventually anyway, and doing
 * it at a town where you're already eating is smarter than a
 * stand-alone fuel stop on the highway.
 *
 * 💚 My Experience Engine
 */

import { type TimedEvent } from './trip-timeline';

/** Forward fuel → meal/rest window */
const FLEX_WINDOW_MINUTES = 90;

/** Meal absorbs fuel window — wider, because pulling fuel to the meal stop
 *  saves a standalone stop no matter how far away the fuel was. */
const MEAL_ABSORB_FUEL_WINDOW_MINUTES = 300; // 5 hours

/** Combined duration for a fuel+meal combo (eat while car fuels/parks — parallel). */
const COMBO_FUEL_MEAL_MINUTES = 45;
const COMBO_FUEL_REST_MINUTES = 20;

type ComboableType = 'meal' | 'rest';

const isFlexible = (e: TimedEvent): e is TimedEvent & { type: ComboableType } =>
  e.type === 'meal' || e.type === 'rest';

const isFuel = (e: TimedEvent): boolean => e.type === 'fuel';
const isMeal = (e: TimedEvent): boolean => e.type === 'meal';

/**
 * Scans `events` for fuel+meal pairs and merges them.
 * Returns a new event array — never mutates the input.
 */
export function applyComboOptimization(
  events: TimedEvent[],
  flexWindowMinutes: number = FLEX_WINDOW_MINUTES,
): TimedEvent[] {
  const result: TimedEvent[] = [...events];
  const consumed = new Set<number>();

  // ── Pass 1: Meal absorbs downstream fuel ───────────────────────────────
  // "I'm eating for 45 min, I'll gas up here too."
  // This pass runs first because it produces the most natural timeline:
  // stop at a town, eat + fuel, then drive uninterrupted.
  for (let i = 0; i < result.length; i++) {
    if (consumed.has(i)) continue;
    const mealEvent = result[i];
    if (!isMeal(mealEvent)) continue;

    // Scan forward for a fuel stop within the absorption window
    let fuelIdx = -1;
    for (let j = i + 1; j < result.length; j++) {
      if (consumed.has(j)) continue;
      const candidate = result[j];
      if (!isFuel(candidate)) continue;

      const gapMinutes =
        (candidate.arrivalTime.getTime() - mealEvent.departureTime.getTime()) / 60000;

      if (gapMinutes < 0) continue;
      if (gapMinutes > MEAL_ABSORB_FUEL_WINDOW_MINUTES) break;

      fuelIdx = j;
      break;
    }

    if (fuelIdx === -1) continue;

    const fuelEvent = result[fuelIdx];

    // Time saved: eliminate the drive to fuel + fuel stop duration.
    // The meal stop is already 45 min — fueling is parallel (adds 0 time).
    const driveMinutesBetween = Math.round(
      (fuelEvent.arrivalTime.getTime() - mealEvent.departureTime.getTime()) / 60000
    );
    const timeSaved = Math.max(0, fuelEvent.durationMinutes + driveMinutesBetween);

    const comboLabel = buildMealLabel(mealEvent, mealEvent.arrivalTime);

    // Combo goes at the MEAL location/time (we're already there eating)
    const merged: TimedEvent = {
      id: `combo-${mealEvent.id}-${fuelEvent.id}`,
      type: 'combo',
      arrivalTime: new Date(mealEvent.arrivalTime),
      departureTime: new Date(mealEvent.departureTime), // same duration as meal
      durationMinutes: mealEvent.durationMinutes,
      distanceFromOriginKm: mealEvent.distanceFromOriginKm,
      locationHint: mealEvent.locationHint,
      stops: [...mealEvent.stops, ...fuelEvent.stops],
      timeSavedMinutes: timeSaved,
      comboLabel,
    };

    result[i] = merged;
    consumed.add(fuelIdx);

    // Rebuild downstream timestamps: remove fuel drive + fuel stop time
    const timeRecoveredMs = (driveMinutesBetween + fuelEvent.durationMinutes) * 60 * 1000;
    for (let k = fuelIdx + 1; k < result.length; k++) {
      if (consumed.has(k)) continue;
      result[k] = {
        ...result[k],
        arrivalTime: new Date(result[k].arrivalTime.getTime() - timeRecoveredMs),
        departureTime: new Date(result[k].departureTime.getTime() - timeRecoveredMs),
      };
    }
  }

  // ── Pass 2: Fuel → nearby meal/rest (original pattern) ─────────────────
  // Only fires for fuel stops not already consumed by Pass 1.
  for (let i = 0; i < result.length; i++) {
    if (consumed.has(i)) continue;
    const fuelEvent = result[i];
    if (!isFuel(fuelEvent)) continue;

    let flexIdx = -1;
    for (let j = i + 1; j < result.length; j++) {
      if (consumed.has(j)) continue;
      const candidate = result[j];
      if (!isFlexible(candidate)) continue;

      const gapMinutes =
        (candidate.arrivalTime.getTime() - fuelEvent.departureTime.getTime()) / 60000;

      if (gapMinutes < 0) continue;
      if (gapMinutes > flexWindowMinutes) break;

      flexIdx = j;
      break;
    }

    if (flexIdx === -1) continue;

    const flexEvent = result[flexIdx];
    const flexType = flexEvent.type as ComboableType;

    const driveMinutesBetween = Math.round(
      (flexEvent.arrivalTime.getTime() - fuelEvent.departureTime.getTime()) / 60000
    );
    const separateTotalMinutes =
      fuelEvent.durationMinutes + driveMinutesBetween + flexEvent.durationMinutes;

    const comboDuration =
      flexType === 'meal' ? COMBO_FUEL_MEAL_MINUTES : COMBO_FUEL_REST_MINUTES;
    const timeSaved = Math.max(0, separateTotalMinutes - comboDuration);

    const comboLabel =
      flexType === 'meal' ? buildMealLabel(flexEvent, fuelEvent.arrivalTime) :
      flexType === 'rest' ? 'Fuel + Break' :
      'Fuel + Stop';

    const comboDep = new Date(
      fuelEvent.arrivalTime.getTime() + comboDuration * 60 * 1000,
    );
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

    result[i] = merged;
    consumed.add(flexIdx);

    const timeRecoveredMs =
      (driveMinutesBetween + flexEvent.durationMinutes) * 60 * 1000;

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

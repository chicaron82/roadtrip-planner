/**
 * day-metadata.ts — Canonical helpers for mutating TripDay metadata.
 *
 * Each function takes the current canonical days array and returns a new
 * array with the target day patched. Lookups are by dayNumber (1-indexed),
 * not by array index, so callers don't need to track position.
 *
 * No-ops when the dayNumber doesn't exist or the value is unchanged.
 */

import type { TripDay, DayType } from '../../types';

/** Patch a single day by dayNumber. Returns the same array reference if
 *  the target day is not found or the patch produces no change. */
function patchDay(days: TripDay[], dayNumber: number, patch: Partial<TripDay>): TripDay[] {
  const idx = days.findIndex(d => d.dayNumber === dayNumber);
  if (idx === -1) return days;
  const updated = { ...days[idx], ...patch };
  const result = [...days];
  result[idx] = updated;
  return result;
}

/** Update the free-text notes on a day (itinerary workspace). */
export function updateDayNotes(
  days: TripDay[],
  dayNumber: number,
  notes: string,
): TripDay[] {
  return patchDay(days, dayNumber, { notes });
}

/** Update the display title on a day (e.g. "Let's Get Outta Here"). */
export function updateDayTitle(
  days: TripDay[],
  dayNumber: number,
  title: string,
): TripDay[] {
  return patchDay(days, dayNumber, { title });
}

/** Update the day type (planned | flexible | free). */
export function updateDayType(
  days: TripDay[],
  dayNumber: number,
  dayType: DayType,
): TripDay[] {
  return patchDay(days, dayNumber, { dayType });
}

/**
 * Generic metadata patcher — use when you need to update multiple fields at
 * once without calling individual helpers in sequence (which would create
 * intermediate arrays unnecessarily).
 */
export function updateDayMetadata(
  days: TripDay[],
  dayNumber: number,
  patch: Partial<Pick<TripDay, 'title' | 'notes' | 'dayType'>>,
): TripDay[] {
  return patchDay(days, dayNumber, patch);
}

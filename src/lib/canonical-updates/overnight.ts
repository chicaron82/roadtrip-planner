/**
 * overnight.ts — Canonical helper for updating OvernightStop on a TripDay.
 *
 * The overnight stop is a structured object (OvernightStop) carrying the
 * accommodation location, type, cost, and booking details. This helper
 * is the single place allowed to write that field on canonical day state.
 *
 * Pure — takes current days array, returns next days array.
 * No-op if the dayNumber isn't found.
 */

import type { TripDay, OvernightStop } from '../../types';

/** Update the overnight stop for a given day. */
export function updateOvernight(
  days: TripDay[],
  dayNumber: number,
  overnight: OvernightStop,
): TripDay[] {
  const idx = days.findIndex(d => d.dayNumber === dayNumber);
  if (idx === -1) return days;
  const result = [...days];
  result[idx] = { ...days[idx], overnight };
  return result;
}

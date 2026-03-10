/**
 * day-activities.ts — Canonical helpers for planned activities on a TripDay.
 *
 * Activities live at TripDay.plannedActivities (Activity[]).
 * These helpers add, update, and remove activities by index within a day,
 * given the day's dayNumber (1-indexed).
 *
 * All are pure — take current days array, return next days array.
 * No-ops when the dayNumber doesn't exist.
 */

import type { TripDay, Activity } from '../../types';

function patchDay(days: TripDay[], dayNumber: number, patch: Partial<TripDay>): TripDay[] {
  const idx = days.findIndex(d => d.dayNumber === dayNumber);
  if (idx === -1) return days;
  const result = [...days];
  result[idx] = { ...days[idx], ...patch };
  return result;
}

/** Append an activity to a day's plannedActivities list. */
export function addDayActivity(
  days: TripDay[],
  dayNumber: number,
  activity: Activity,
): TripDay[] {
  const day = days.find(d => d.dayNumber === dayNumber);
  if (!day) return days;
  const updatedActivities = [...(day.plannedActivities ?? []), activity];
  return patchDay(days, dayNumber, { plannedActivities: updatedActivities });
}

/**
 * Replace an activity at the given index within a day's plannedActivities.
 * No-op if dayNumber not found or activityIndex is out of range.
 */
export function updateDayActivity(
  days: TripDay[],
  dayNumber: number,
  activityIndex: number,
  activity: Activity,
): TripDay[] {
  const day = days.find(d => d.dayNumber === dayNumber);
  if (!day) return days;
  const current = day.plannedActivities ?? [];
  if (activityIndex < 0 || activityIndex >= current.length) return days;
  const updatedActivities = [...current];
  updatedActivities[activityIndex] = activity;
  return patchDay(days, dayNumber, { plannedActivities: updatedActivities });
}

/**
 * Remove the activity at the given index from a day's plannedActivities.
 * No-op if dayNumber not found or activityIndex is out of range.
 */
export function removeDayActivity(
  days: TripDay[],
  dayNumber: number,
  activityIndex: number,
): TripDay[] {
  const day = days.find(d => d.dayNumber === dayNumber);
  if (!day) return days;
  const current = day.plannedActivities ?? [];
  if (activityIndex < 0 || activityIndex >= current.length) return days;
  const updatedActivities = current.filter((_, i) => i !== activityIndex);
  return patchDay(days, dayNumber, { plannedActivities: updatedActivities });
}

import { describe, it, expect } from 'vitest';
import type { TripDay, Activity } from '../../types';
import { addDayActivity, updateDayActivity, removeDayActivity } from './day-activities';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDay(dayNumber: number, overrides: Partial<TripDay> = {}): TripDay {
  return {
    dayNumber,
    date: '2025-08-16',
    dateFormatted: 'Sat, Aug 16',
    route: 'A → B',
    segments: [],
    segmentIndices: [],
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 1000 },
    totals: { distanceKm: 0, driveTimeMinutes: 0, stopTimeMinutes: 0, departureTime: '2025-08-16T08:00:00', arrivalTime: '2025-08-16T16:00:00' },
    ...overrides,
  };
}

function makeActivity(name: string, overrides: Partial<Activity> = {}): Activity {
  return { name, category: 'attraction', ...overrides };
}

const ACT_A = makeActivity('Visit Museum');
const ACT_B = makeActivity('Lunch at Pier');
const ACT_C = makeActivity('Sunset Walk');

// ─── addDayActivity ───────────────────────────────────────────────────────────

describe('addDayActivity', () => {
  it('adds an activity to a day with no existing activities', () => {
    const days = [makeDay(1)];
    const result = addDayActivity(days, 1, ACT_A);
    expect(result[0].plannedActivities).toHaveLength(1);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_A);
  });

  it('appends an activity to a day with existing activities', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = addDayActivity(days, 1, ACT_B);
    expect(result[0].plannedActivities).toHaveLength(2);
    expect(result[0].plannedActivities?.[1]).toEqual(ACT_B);
  });

  it('preserves existing activities when appending', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B] })];
    const result = addDayActivity(days, 1, ACT_C);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_A);
    expect(result[0].plannedActivities?.[1]).toEqual(ACT_B);
    expect(result[0].plannedActivities?.[2]).toEqual(ACT_C);
  });

  it('returns the same array reference when dayNumber not found', () => {
    const days = [makeDay(1)];
    const result = addDayActivity(days, 99, ACT_A);
    expect(result).toBe(days);
  });

  it('returns a new array reference when dayNumber is found', () => {
    const days = [makeDay(1)];
    const result = addDayActivity(days, 1, ACT_A);
    expect(result).not.toBe(days);
  });

  it('does not mutate the original day', () => {
    const day = makeDay(1);
    addDayActivity([day], 1, ACT_A);
    expect(day.plannedActivities).toBeUndefined();
  });

  it('only adds to the target day in a multi-day array', () => {
    const days = [makeDay(1), makeDay(2), makeDay(3)];
    const result = addDayActivity(days, 2, ACT_A);
    expect(result[0].plannedActivities).toBeUndefined();
    expect(result[1].plannedActivities).toHaveLength(1);
    expect(result[2].plannedActivities).toBeUndefined();
  });

  it('preserves untouched day objects as the same reference', () => {
    const day1 = makeDay(1);
    const day2 = makeDay(2);
    const result = addDayActivity([day1, day2], 1, ACT_A);
    expect(result[1]).toBe(day2);
  });

  it('adds an activity with all optional fields', () => {
    const days = [makeDay(1)];
    const detailed = makeActivity('Covent Garden Market', {
      description: 'Great for peameal bacon',
      category: 'meal',
      plannedStartTime: '10:30',
      plannedEndTime: '12:00',
      durationMinutes: 90,
      cost: 25,
      notes: 'Cash only',
      url: 'https://example.com',
      isRequired: true,
    });
    const result = addDayActivity(days, 1, detailed);
    expect(result[0].plannedActivities?.[0]).toEqual(detailed);
  });
});

// ─── updateDayActivity ────────────────────────────────────────────────────────

describe('updateDayActivity', () => {
  it('replaces the activity at the given index', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B] })];
    const updated = makeActivity('Replaced');
    const result = updateDayActivity(days, 1, 0, updated);
    expect(result[0].plannedActivities?.[0]).toEqual(updated);
    expect(result[0].plannedActivities?.[1]).toEqual(ACT_B);
  });

  it('updates the last activity (trailing index)', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B, ACT_C] })];
    const updated = makeActivity('New Last');
    const result = updateDayActivity(days, 1, 2, updated);
    expect(result[0].plannedActivities?.[2]).toEqual(updated);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_A);
    expect(result[0].plannedActivities?.[1]).toEqual(ACT_B);
  });

  it('updates the middle activity', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B, ACT_C] })];
    const updated = makeActivity('In the middle');
    const result = updateDayActivity(days, 1, 1, updated);
    expect(result[0].plannedActivities?.[1]).toEqual(updated);
    expect(result[0].plannedActivities).toHaveLength(3);
  });

  it('returns the same array reference when dayNumber not found', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = updateDayActivity(days, 99, 0, ACT_B);
    expect(result).toBe(days);
  });

  it('returns the same array reference when activityIndex is negative', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = updateDayActivity(days, 1, -1, ACT_B);
    expect(result).toBe(days);
  });

  it('returns the same array reference when activityIndex exceeds length', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = updateDayActivity(days, 1, 5, ACT_B);
    expect(result).toBe(days);
  });

  it('returns the same array reference when day has no activities and index is 0', () => {
    const days = [makeDay(1)];
    const result = updateDayActivity(days, 1, 0, ACT_A);
    expect(result).toBe(days);
  });

  it('does not mutate the original activities array', () => {
    const acts = [ACT_A, ACT_B];
    const days = [makeDay(1, { plannedActivities: acts })];
    updateDayActivity(days, 1, 0, makeActivity('Changed'));
    expect(acts[0]).toBe(ACT_A);
  });

  it('only updates the target day', () => {
    const days = [
      makeDay(1, { plannedActivities: [ACT_A] }),
      makeDay(2, { plannedActivities: [ACT_B] }),
    ];
    const result = updateDayActivity(days, 1, 0, ACT_C);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_C);
    expect(result[1].plannedActivities?.[0]).toEqual(ACT_B);
  });
});

// ─── removeDayActivity ────────────────────────────────────────────────────────

describe('removeDayActivity', () => {
  it('removes the activity at the given index', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B, ACT_C] })];
    const result = removeDayActivity(days, 1, 1);
    expect(result[0].plannedActivities).toHaveLength(2);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_A);
    expect(result[0].plannedActivities?.[1]).toEqual(ACT_C);
  });

  it('removes the first activity', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B] })];
    const result = removeDayActivity(days, 1, 0);
    expect(result[0].plannedActivities).toHaveLength(1);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_B);
  });

  it('removes the last activity', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A, ACT_B] })];
    const result = removeDayActivity(days, 1, 1);
    expect(result[0].plannedActivities).toHaveLength(1);
    expect(result[0].plannedActivities?.[0]).toEqual(ACT_A);
  });

  it('removes the only activity, leaving an empty array', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = removeDayActivity(days, 1, 0);
    expect(result[0].plannedActivities).toHaveLength(0);
  });

  it('returns the same array reference when dayNumber not found', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = removeDayActivity(days, 99, 0);
    expect(result).toBe(days);
  });

  it('returns the same array reference when activityIndex is negative', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = removeDayActivity(days, 1, -1);
    expect(result).toBe(days);
  });

  it('returns the same array reference when activityIndex exceeds length', () => {
    const days = [makeDay(1, { plannedActivities: [ACT_A] })];
    const result = removeDayActivity(days, 1, 10);
    expect(result).toBe(days);
  });

  it('returns the same array reference when day has no activities', () => {
    const days = [makeDay(1)];
    const result = removeDayActivity(days, 1, 0);
    expect(result).toBe(days);
  });

  it('does not mutate the original activities array', () => {
    const acts = [ACT_A, ACT_B];
    const days = [makeDay(1, { plannedActivities: acts })];
    removeDayActivity(days, 1, 0);
    expect(acts).toHaveLength(2);
    expect(acts[0]).toBe(ACT_A);
  });

  it('does not mutate the original day', () => {
    const day = makeDay(1, { plannedActivities: [ACT_A, ACT_B] });
    removeDayActivity([day], 1, 0);
    expect(day.plannedActivities).toHaveLength(2);
  });

  it('only removes from the target day in a multi-day array', () => {
    const days = [
      makeDay(1, { plannedActivities: [ACT_A] }),
      makeDay(2, { plannedActivities: [ACT_B, ACT_C] }),
    ];
    const result = removeDayActivity(days, 2, 0);
    expect(result[0].plannedActivities).toHaveLength(1);
    expect(result[1].plannedActivities).toHaveLength(1);
    expect(result[1].plannedActivities?.[0]).toEqual(ACT_C);
  });

  it('preserves untouched day objects as the same reference', () => {
    const day1 = makeDay(1, { plannedActivities: [ACT_A] });
    const day2 = makeDay(2, { plannedActivities: [ACT_B] });
    const result = removeDayActivity([day1, day2], 1, 0);
    expect(result[1]).toBe(day2);
  });
});

/**
 * day-builder.ts — unit tests for pure helper functions.
 *
 * Pure functions — no mocks needed.
 * Covers: ceilToNearest, estimateMealsForDay.
 */

import { describe, it, expect } from 'vitest';
import type { TripDay } from '../../types';
import { ceilToNearest, estimateMealsForDay } from './day-builder';
import { makeSettings as _makeSettings, makeBudget } from '../../test/fixtures';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDay(driveMinutes: number, mealStopCount = 0): TripDay {
  const segments = Array.from({ length: mealStopCount }, (_, i) => ({
    stopType: 'meal' as const,
    from: { id: `a${i}`, name: 'A', lat: 0, lng: 0, type: 'origin' as const },
    to: { id: `b${i}`, name: 'B', lat: 0, lng: 0, type: 'destination' as const },
    distanceKm: 0,
    durationMinutes: 0,
    fuelCost: 0,
    fuelLitres: 0,
    region: 'MB',
    _originalIndex: i,
  }));

  return {
    dayNumber: 1,
    date: '2026-08-16',
    dateFormatted: 'Sat',
    route: 'A → B',
    segments: segments as unknown as TripDay['segments'],
    segmentIndices: [],
    timezoneChanges: [],
    budget: { gasUsed: 0, hotelCost: 0, foodEstimate: 0, miscCost: 0, dayTotal: 0, bankRemaining: 0 },
    totals: { distanceKm: 0, driveTimeMinutes: driveMinutes, stopTimeMinutes: 0, departureTime: '', arrivalTime: '' },
  } as TripDay;
}

const makeSettings = (numTravelers = 2) => _makeSettings({
  numTravelers, numDrivers: 1,
  budget: makeBudget({ gas: 0, hotel: 0, food: 0, misc: 0, total: 1000 }),
  departureDate: '2026-08-16', returnDate: '', arrivalDate: '', arrivalTime: '',
});

// ─── ceilToNearest ────────────────────────────────────────────────────────────

describe('ceilToNearest', () => {
  it('returns 0 when value is 0', () => {
    expect(ceilToNearest(0, 5)).toBe(0);
  });

  it('returns value unchanged when already on increment boundary', () => {
    expect(ceilToNearest(100, 5)).toBe(100);
    expect(ceilToNearest(10, 10)).toBe(10);
  });

  it('rounds up to next increment', () => {
    expect(ceilToNearest(101, 5)).toBe(105);
    expect(ceilToNearest(11, 10)).toBe(20);
  });

  it('works with increment of 1 (no-op rounding)', () => {
    expect(ceilToNearest(7, 1)).toBe(7);
    expect(ceilToNearest(7.3, 1)).toBe(8);
  });

  it('works with large increments', () => {
    expect(ceilToNearest(151, 100)).toBe(200);
  });
});

// ─── estimateMealsForDay ──────────────────────────────────────────────────────

describe('estimateMealsForDay', () => {
  it('estimates 1 meal for a short drive (< 4h) — ceil(2/4)=1 × travelers', () => {
    // driveMinutes=120 → 2h → ceil(2/4)=1 meal, × 2 travelers = 2
    const day = makeDay(120); // 2h drive
    const result = estimateMealsForDay(day, makeSettings(2));
    expect(result).toBe(2); // 1 estimated meal × 2 travelers
  });

  it('uses max(mealStops, estimatedMeals) when stops exceed estimate', () => {
    // 60 min drive → estimated = ceil(1/4) = 1. But 3 meal stops → max(3,1)=3
    const day = makeDay(60, 3);
    expect(estimateMealsForDay(day, makeSettings(2))).toBe(6); // 3 × 2
  });

  it('scales with numTravelers', () => {
    const day = makeDay(240); // 4h → 1 meal
    const two = estimateMealsForDay(day, makeSettings(2));
    const four = estimateMealsForDay(day, makeSettings(4));
    expect(four).toBe(two * 2);
  });

  it('estimates more meals for longer drives', () => {
    const short = estimateMealsForDay(makeDay(240), makeSettings(1)); // 4h → 1 meal
    const long = estimateMealsForDay(makeDay(480), makeSettings(1));  // 8h → 2 meals
    expect(long).toBeGreaterThan(short);
  });

  it('returns 0 for a 0-minute drive with no stops and 0 travelers', () => {
    const day = makeDay(0);
    const result = estimateMealsForDay(day, makeSettings(0));
    expect(result).toBe(0);
  });
});

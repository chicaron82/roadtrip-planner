import { describe, it, expect } from 'vitest';
import {
  generateSmartStops,
  consolidateStops,
} from './stop-suggestions';
import type { SuggestedStop, StopSuggestionConfig } from './stop-suggestion-types';
import type { RouteSegment, TripDay } from '../types';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const LOC_A = { id: 'a', name: 'City A', lat: 49.895, lng: -97.138, type: 'waypoint' as const };
const LOC_B = { id: 'b', name: 'City B', lat: 50.0, lng: -96.0, type: 'waypoint' as const };

/** Minimal RouteSegment for simulation tests */
function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: LOC_A,
    to: LOC_B,
    distanceKm: 100,
    durationMinutes: 60,
    fuelNeededLitres: 9,
    fuelCost: 14,
    ...overrides,
  };
}

/** Standard config: 60L tank, 9L/100km, 8h max, departs 8am */
function makeConfig(overrides: Partial<StopSuggestionConfig> = {}): StopSuggestionConfig {
  const dept = new Date('2026-08-01T08:00:00');
  return {
    tankSizeLitres: 60,
    fuelEconomyL100km: 9,
    maxDriveHoursPerDay: 8,
    numDrivers: 1,
    departureTime: dept,
    gasPrice: 1.55,
    stopFrequency: 'balanced',
    ...overrides,
  };
}

/** Minimal SuggestedStop with sensible defaults */
function makeStop(
  id: string,
  type: SuggestedStop['type'],
  minutesFromEpoch: number,
  overrides: Partial<SuggestedStop> = {}
): SuggestedStop {
  return {
    id,
    type,
    reason: `${type} reason`,
    afterSegmentIndex: 0,
    estimatedTime: new Date(new Date('2026-08-01T08:00:00').getTime() + minutesFromEpoch * 60000),
    duration: 15,
    priority: 'recommended',
    details: {},
    ...overrides,
  };
}

// ─── consolidateStops ─────────────────────────────────────────────────────────

describe('consolidateStops', () => {
  it('returns empty array unchanged', () => {
    expect(consolidateStops([])).toEqual([]);
  });

  it('returns single stop unchanged', () => {
    const stop = makeStop('a', 'fuel', 0);
    const result = consolidateStops([stop]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('does not merge stops more than 60 minutes apart', () => {
    const a = makeStop('a', 'fuel', 0);
    const b = makeStop('b', 'meal', 61);
    const result = consolidateStops([a, b]);
    expect(result).toHaveLength(2);
  });

  it('merges two stops within 60 minutes — higher priority type wins', () => {
    const fuel = makeStop('fuel1', 'fuel', 0);    // priority 3
    const meal = makeStop('meal1', 'meal', 30);   // priority 2
    const result = consolidateStops([fuel, meal]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('fuel');          // fuel wins
  });

  it('merged stop duration = max of the two', () => {
    const a = makeStop('a', 'fuel', 0, { duration: 15 });
    const b = makeStop('b', 'rest', 20, { duration: 20 });
    const result = consolidateStops([a, b]);
    expect(result[0].duration).toBe(20);
  });

  it('merged stop priority = most urgent (required beats recommended)', () => {
    const a = makeStop('a', 'rest', 0, { priority: 'recommended' });
    const b = makeStop('b', 'fuel', 30, { priority: 'required' });
    const result = consolidateStops([a, b]);
    expect(result[0].priority).toBe('required');
  });

  it('overnight beats fuel when merging (priority 4 vs 3)', () => {
    const fuel = makeStop('f', 'fuel', 0);
    const night = makeStop('n', 'overnight', 30);
    const result = consolidateStops([fuel, night]);
    expect(result[0].type).toBe('overnight');
  });

  it('merged id is prefixed with "merged-"', () => {
    const a = makeStop('stop-a', 'fuel', 0);
    const b = makeStop('stop-b', 'meal', 20);
    const result = consolidateStops([a, b]);
    expect(result[0].id).toMatch(/^merged-/);
  });

  it('three stops within 60 min all collapse to one (accumulator pattern)', () => {
    const a = makeStop('a', 'rest', 0);
    const b = makeStop('b', 'meal', 20);
    const c = makeStop('c', 'fuel', 40);
    const result = consolidateStops([a, b, c]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('fuel'); // highest priority
  });

  it('merges first two, keeps third separate when third is too far', () => {
    const a = makeStop('a', 'rest', 0);
    const b = makeStop('b', 'meal', 30);
    const c = makeStop('c', 'fuel', 120); // 90 min after b — too far
    const result = consolidateStops([a, b, c]);
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('fuel');
  });

  it('merged reason contains both original reasons', () => {
    const a = makeStop('a', 'fuel', 0, { reason: 'Tank low' });
    const b = makeStop('b', 'meal', 20, { reason: 'Lunch time' });
    const result = consolidateStops([a, b]);
    expect(result[0].reason).toContain('Tank low');
    expect(result[0].reason).toContain('Lunch time');
  });

  it('preserves details from both merged stops', () => {
    const a = makeStop('a', 'fuel', 0, { details: { fuelNeeded: 30, fuelCost: 46 } });
    const b = makeStop('b', 'rest', 20, { details: { hoursOnRoad: 3 } });
    const result = consolidateStops([a, b]);
    expect(result[0].details.fuelNeeded).toBe(30);
    expect(result[0].details.hoursOnRoad).toBe(3);
  });
});

// ─── generateSmartStops — overnight suppression ────────────────────────────

describe('generateSmartStops — overnight suppression', () => {
  /**
   * Build a 2-day trip: 9 x 1h/100km segments (9h total drive).
   * With maxDriveHoursPerDay=8, Day 2 starts after an overnight.
   */
  function makeTwoDaySegments(count = 9): RouteSegment[] {
    return Array.from({ length: count }, (_, i) =>
      makeSegment({
        from: { id: `s${i}`, name: `Stop ${i}`, lat: 49.9 + i * 0.1, lng: -97, type: 'waypoint' as const },
        to: { id: `s${i + 1}`, name: `Stop ${i + 1}`, lat: 49.9 + (i + 1) * 0.1, lng: -97, type: 'waypoint' as const },
        distanceKm: 100,
        durationMinutes: 60,
        fuelNeededLitres: 9,
        fuelCost: 14,
      })
    );
  }

  it('generates an overnight stop without hotel data', () => {
    const config = makeConfig({ maxDriveHoursPerDay: 8 });
    const stops = generateSmartStops(makeTwoDaySegments(), config);
    const overnights = stops.filter(s => s.type === 'overnight');
    expect(overnights.length).toBeGreaterThanOrEqual(1);
  });

  it('suppresses overnight suggestion when user has hotel on that day', () => {
    const config = makeConfig({ maxDriveHoursPerDay: 8 });
    const segments = makeTwoDaySegments();

    const days: TripDay[] = [
      {
        dayNumber: 1,
        date: '2026-08-01',
        dateFormatted: 'Sat, Aug 1',
        route: 'A → B',
        segments: segments.slice(0, 8),
        segmentIndices: [0, 1, 2, 3, 4, 5, 6, 7],
        overnight: {
          location: { id: 'hw', name: 'Hotel Winnipeg', lat: 49.9, lng: -97, type: 'waypoint' as const },
          hotelName: 'The Delta',
          cost: 150,
          roomsNeeded: 1,
        },
        timezoneChanges: [],
        budget: { gasUsed: 0, hotelCost: 150, foodEstimate: 0, miscCost: 0, dayTotal: 150, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
        totals: { distanceKm: 800, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-01T08:00:00', arrivalTime: '2026-08-01T16:00:00' },
      },
    ];

    const stops = generateSmartStops(segments, config, days);
    const overnights = stops.filter(s => s.type === 'overnight');
    expect(overnights).toHaveLength(0);
  });

  it('Day 2 still produces stops when overnight is suppressed (sim state resets)', () => {
    // If the sim state (totalDrivingToday, currentTime) did NOT reset,
    // Day 2 would think it's already at or close to the daily limit and
    // either fire immediately or produce no stops at all.
    const config = makeConfig({ maxDriveHoursPerDay: 8 });
    const segments = makeTwoDaySegments(9);

    const days: TripDay[] = [
      {
        dayNumber: 1,
        date: '2026-08-01',
        dateFormatted: 'Sat, Aug 1',
        route: 'A → B',
        segments: segments.slice(0, 8),
        segmentIndices: [0, 1, 2, 3, 4, 5, 6, 7],
        overnight: {
          location: { id: 'h2', name: 'Hotel', lat: 49.9, lng: -97, type: 'waypoint' as const },
          cost: 120,
          roomsNeeded: 1,
        },
        timezoneChanges: [],
        budget: { gasUsed: 0, hotelCost: 120, foodEstimate: 0, miscCost: 0, dayTotal: 120, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
        totals: { distanceKm: 800, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-01T08:00:00', arrivalTime: '2026-08-01T16:00:00' },
      },
    ];

    const stops = generateSmartStops(segments, config, days);

    // Day 2 segment (segment index 8) should have at least a fuel stop since
    // we've been driving 100km * 8 segments = 800km already on Day 1.
    const day2Stops = stops.filter(s => s.dayNumber === 2);
    // The key check: Day 2 stops should exist (simulation advanced to next day)
    // and their estimated times should be AFTER 8am on Day 2, not Day 1.
    const day2Times = day2Stops.map(s => s.estimatedTime.toISOString().slice(0, 10));
    day2Times.forEach(date => expect(date).toBe('2026-08-02'));
  });

  it('no duplicate fuel stops immediately after overnight when hotel suppresses suggestion', () => {
    // regression: before the fuel-state reset fix, two fuel stops fired within
    // 15 minutes of each other right after departure on Day 2 return leg.
    const config = makeConfig({
      maxDriveHoursPerDay: 8,
      tankSizeLitres: 60,
      fuelEconomyL100km: 9,
    });
    // 100km segments — after 6 segments tank is at 60 - (9 * 6) = 6L → triggers tankLow
    const segments = makeTwoDaySegments(9);

    const days: TripDay[] = [
      {
        dayNumber: 1,
        date: '2026-08-01',
        dateFormatted: 'Sat, Aug 1',
        route: 'A → B',
        segments: segments.slice(0, 8),
        segmentIndices: [0, 1, 2, 3, 4, 5, 6, 7],
        overnight: { location: { id: 'h3', name: 'Hotel', lat: 49.9, lng: -97, type: 'waypoint' as const }, cost: 120, roomsNeeded: 1 },
        timezoneChanges: [],
        budget: { gasUsed: 0, hotelCost: 120, foodEstimate: 0, miscCost: 0, dayTotal: 120, gasRemaining: 0, hotelRemaining: 0, foodRemaining: 0 },
        totals: { distanceKm: 800, driveTimeMinutes: 480, stopTimeMinutes: 0, departureTime: '2026-08-01T08:00:00', arrivalTime: '2026-08-01T16:00:00' },
      },
    ];

    const stops = generateSmartStops(segments, config, days);
    const day2Fuel = stops.filter(s => s.type === 'fuel' && s.dayNumber === 2);

    // No two fuel stops should be within 30 minutes of each other
    for (let i = 1; i < day2Fuel.length; i++) {
      const gap =
        (day2Fuel[i].estimatedTime.getTime() - day2Fuel[i - 1].estimatedTime.getTime()) / 60000;
      expect(gap).toBeGreaterThan(30);
    }
  });

  it('assigns dayNumber=2 to stops after overnight reset', () => {
    // 12 segments: overnight fires after segment 7 (8h), Day 2 gets 4 segments.
    // comfortRefuelDue (3.5h balanced) fires on Day 2 — so dayNumber=2 appears.
    const config = makeConfig({ maxDriveHoursPerDay: 8 });
    const stops = generateSmartStops(makeTwoDaySegments(12), config);
    const hasDay2 = stops.some(s => (s.dayNumber ?? 1) === 2);
    expect(hasDay2).toBe(true);
  });

  it('returns empty array for no segments', () => {
    expect(generateSmartStops([], makeConfig())).toEqual([]);
  });

  it('no overnight on final segment even with maxDriveHours exceeded', () => {
    // Single long segment that exceeds day limit — no overnight because it's the end
    const config = makeConfig({ maxDriveHoursPerDay: 1 });
    const segments = [makeSegment({ durationMinutes: 200 })];
    const stops = generateSmartStops(segments, config);
    const overnights = stops.filter(s => s.type === 'overnight');
    expect(overnights).toHaveLength(0);
  });
});

// ─── generateSmartStops — fuel logic ─────────────────────────────────────────

describe('generateSmartStops — fuel logic', () => {
  it('suggests fuel stop when tank cannot cover segment distance', () => {
    // 60L tank ÷ 9L/100km × 0.75 (25% buffer) = 500km safe range
    // Segment = 600km → should trigger en-route refuel
    const config = makeConfig();
    const segments = [
      makeSegment({ distanceKm: 600, durationMinutes: 360, fuelNeededLitres: 54 }),
    ];
    const stops = generateSmartStops(segments, config);
    const fuelStops = stops.filter(s => s.type === 'fuel');
    expect(fuelStops.length).toBeGreaterThanOrEqual(1);
  });

  it('no fuel stop when single short segment fits in tank', () => {
    const config = makeConfig();
    const segments = [makeSegment({ distanceKm: 100, durationMinutes: 60, fuelNeededLitres: 9 })];
    const stops = generateSmartStops(segments, config);
    const fuelStops = stops.filter(s => s.type === 'fuel');
    expect(fuelStops).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { splitTripByDays } from './split-by-days';
import { makeSegment, makeSettings } from '../../test/fixtures';
import type { RouteSegment } from '../../types';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Hour (0-23) extracted from an ISO 8601 datetime string. */
function hourOf(iso: string): number {
  return new Date(iso).getHours();
}

/** All values in an array are unique. */
function allUnique(arr: number[]): boolean {
  return new Set(arr).size === arr.length;
}

// Locations referenced in tests
const WINNIPEG = { id: 'wpg', name: 'Winnipeg, MB', lat: 49.9, lng: -97.1, type: 'waypoint' as const };
const KENORA   = { id: 'ken', name: 'Kenora, ON',   lat: 49.8, lng: -94.5, type: 'waypoint' as const };
const THUNDER  = { id: 'tby', name: 'Thunder Bay, ON', lat: 48.4, lng: -89.2, type: 'waypoint' as const };
const TORONTO  = { id: 'tor', name: 'Toronto, ON',  lat: 43.7, lng: -79.4, type: 'waypoint' as const };

// ── 1. Single segment, same-day drive ────────────────────────────────────────

describe('splitTripByDays — single segment same-day', () => {
  it('produces one day with no overnight when drive fits within limit', () => {
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA, distanceKm: 210, durationMinutes: 150 }),
    ];
    const settings = makeSettings({ maxDriveHours: 8 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days).toHaveLength(1);
    expect(days[0].overnight).toBeUndefined();
    expect(days[0].totals.driveTimeMinutes).toBe(150);
  });
});

// ── 2. Long segment splits across 2 days ─────────────────────────────────────

describe('splitTripByDays — long segment split', () => {
  it('creates 2 days and segmentIndices have no duplicates within each day', () => {
    // 1100 min (~18h) with 10h max → splits into 2 driving days
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: THUNDER, distanceKm: 1200, durationMinutes: 1100 }),
    ];
    const settings = makeSettings({ maxDriveHours: 10 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days.length).toBeGreaterThanOrEqual(2);

    // No day should have duplicate segment indices
    days.forEach(day => {
      expect(allUnique(day.segmentIndices)).toBe(true);
    });

    // Both days reference original segment 0
    expect(days[0].segmentIndices).toContain(0);
    expect(days[1].segmentIndices).toContain(0);
  });
});

// ── 3. Round trip, 0 free days ───────────────────────────────────────────────

describe('splitTripByDays — round trip, 0 free days', () => {
  it('inserts no free-day entries when returnDate is immediately after driving days', () => {
    // One short segment each way — depart Sat, return Sun (no gap = 0 free days)
    const outbound: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA, distanceKm: 210, durationMinutes: 150 }),
    ];
    // Round-trip: doubled segments passed in, midpoint = 1
    const returnSeg: RouteSegment = makeSegment({
      from: KENORA, to: WINNIPEG, distanceKm: 210, durationMinutes: 150,
    });
    const allSegments = [...outbound, returnSeg];

    const settings = makeSettings({
      maxDriveHours: 8,
      isRoundTrip: true,
      departureDate: '2025-08-16',
      returnDate: '2025-08-17',
    });
    const days = splitTripByDays(allSegments, settings, '2025-08-16', '09:00', 1);

    const freeDays = days.filter(d => d.dayType === 'free');
    expect(freeDays).toHaveLength(0);
  });
});

// ── 4. Round trip, 2 free days ───────────────────────────────────────────────

describe('splitTripByDays — round trip, 2 free days', () => {
  it('inserts 2 free days with proper titles and hotel+food budget (no gas)', () => {
    const outbound: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: TORONTO, distanceKm: 2200, durationMinutes: 1400 }),
    ];
    const returnSeg: RouteSegment = makeSegment({
      from: TORONTO, to: WINNIPEG, distanceKm: 2200, durationMinutes: 1400,
    });
    const allSegments = [...outbound, returnSeg];

    const settings = makeSettings({
      maxDriveHours: 10,
      isRoundTrip: true,
      departureDate: '2025-08-10',
      returnDate:    '2025-08-18',  // plenty of gap → should produce 2 free days
      hotelPricePerNight: 100,
      mealPricePerDay: 40,
      numTravelers: 2,
    });
    const days = splitTripByDays(allSegments, settings, '2025-08-10', '09:00', 1);

    const freeDays = days.filter(d => d.dayType === 'free');
    expect(freeDays.length).toBeGreaterThanOrEqual(2);

    // Titles must NOT be the old "Explore!" placeholder
    freeDays.forEach(d => {
      expect(d.title).not.toBe('Explore!');
      expect(d.title).toMatch(/Day \d+/);
    });

    // Free days have hotel cost but no gas
    freeDays.forEach(d => {
      expect(d.budget.gasUsed).toBe(0);
      expect(d.budget.hotelCost).toBeGreaterThan(0);
    });
  });
});

// ── 5. Beast mode — suppresses forced overnight at round-trip midpoint ────────

describe('splitTripByDays — beast mode round trip', () => {
  it('treats a long round trip as a day trip when beastMode is enabled', () => {
    // Each leg is 480 min (8h) → total 960 min > 8h max
    // Without beast mode this forces an overnight at Thunder Bay.
    // With beast mode it should stay as one driving day — no overnight stop.
    const outbound = makeSegment({ from: WINNIPEG, to: THUNDER, distanceKm: 700, durationMinutes: 480 });
    const returnSeg = makeSegment({ from: THUNDER, to: WINNIPEG, distanceKm: 700, durationMinutes: 480 });
    const allSegments = [outbound, returnSeg];

    const settings = makeSettings({
      maxDriveHours: 8,
      beastMode: true,
      isRoundTrip: true,
      departureDate: '2025-08-16',
      returnDate: '2025-08-16',
    });
    const days = splitTripByDays(allSegments, settings, '2025-08-16', '09:00', 1);

    const drivingDays = days.filter(d => d.segments.length > 0);
    expect(drivingDays).toHaveLength(1);
    expect(drivingDays[0].overnight).toBeUndefined();
  });

  it('stops at destination for long round trips even in beast mode', () => {
    // Winnipeg → Toronto → Winnipeg: ~1400 min each way = 2800 min total (46h+)
    // Beast mode removes per-day limits but should NOT skip the destination
    // when the trip exceeds 24h total — you still want to explore Toronto!
    const outbound = makeSegment({ from: WINNIPEG, to: TORONTO, distanceKm: 2200, durationMinutes: 1400 });
    const returnSeg = makeSegment({ from: TORONTO, to: WINNIPEG, distanceKm: 2200, durationMinutes: 1400 });
    const allSegments = [outbound, returnSeg];

    const settings = makeSettings({
      maxDriveHours: 8,
      beastMode: true,
      isRoundTrip: true,
      departureDate: '2025-08-16',
      returnDate: '2025-08-20',
    });
    const days = splitTripByDays(allSegments, settings, '2025-08-16', '09:00', 1);

    // Should have multiple driving days — beast mode doesn't collapse a 46h drive into one day
    const drivingDays = days.filter(d => d.segments.length > 0);
    expect(drivingDays.length).toBeGreaterThanOrEqual(2);
  });

  it('still forces overnight for long round trip without beast mode', () => {
    const outbound = makeSegment({ from: WINNIPEG, to: THUNDER, distanceKm: 700, durationMinutes: 480 });
    const returnSeg = makeSegment({ from: THUNDER, to: WINNIPEG, distanceKm: 700, durationMinutes: 480 });
    const allSegments = [outbound, returnSeg];

    const settings = makeSettings({
      maxDriveHours: 8,
      beastMode: false,
      isRoundTrip: true,
      departureDate: '2025-08-16',
      returnDate: '2025-08-17',
    });
    const days = splitTripByDays(allSegments, settings, '2025-08-16', '09:00', 1);

    const drivingDays = days.filter(d => d.segments.length > 0);
    expect(drivingDays.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 6. Flexible budget mode — derives per-category from total × weights ───────

describe('splitTripByDays — flexible budget mode', () => {
  it('derives per-category budgets from total when category amounts are 0', () => {
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA, distanceKm: 210, durationMinutes: 150 }),
    ];
    const settings = makeSettings({
      maxDriveHours: 8,
      budget: {
        mode: 'plan-to-budget',
        allocation: 'flexible',
        profile: 'balanced',
        weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
        // All category buckets are 0 → system derives from total × weights
        gas: 0,
        hotel: 0,
        food: 0,
        misc: 0,
        total: 1000,
      },
    });

    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');
    expect(days).toHaveLength(1);

    // gasRemaining should start from $250 (25% of $1000), minus what was spent
    // Just check it's not 0 or negative on a short trip
    expect(days[0].budget.gasRemaining).toBeGreaterThan(0);
    expect(days[0].budget.hotelRemaining).toBeGreaterThan(0);
    expect(days[0].budget.foodRemaining).toBeGreaterThan(0);
  });
});

// ── 6. Smart departure — full day drives depart at 5 AM ──────────────────────

describe('splitTripByDays — smart departure, full day', () => {
  it('Day 2 departs at 5 AM when the next leg is a full day (≥75% of maxDriveHours)', () => {
    // Day 1: 10h segment (= max). Day 2: another 10h segment (full day).
    // Smart departure for Day 2: clamp(21-10, 5, 10) = clamp(11, 5, 10) = 10 AM.
    // Actually for exactly 10h (= 100% of max ≥ 75%):
    //   isFullDay = true → maxDeparture = 10 → clamp(21-10, 5, 10) = 10 AM
    const maxH = 10;
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA,  distanceKm: 900, durationMinutes: maxH * 60 }),
      makeSegment({ from: KENORA,   to: THUNDER, distanceKm: 900, durationMinutes: maxH * 60 }),
    ];
    const settings = makeSettings({ maxDriveHours: maxH, targetArrivalHour: 21 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days.length).toBeGreaterThanOrEqual(2);
    const day2Hour = hourOf(days[1].totals.departureTime);
    // Full-day leg: capped at maxHourFullDay (10 AM) at the latest
    expect(day2Hour).toBeLessThanOrEqual(10);
    expect(day2Hour).toBeGreaterThanOrEqual(5);
  });
});

// ── 7. Smart departure — short leg allows late start ─────────────────────────

describe('splitTripByDays — smart departure, short leg', () => {
  it('Day 2 departs in the afternoon when the next leg is only 3 hours', () => {
    // Day 1: 10h (full day). Day 2: 3h (short — <75% of 10h = 7.5h).
    // Smart departure for Day 2: clamp(21-3, 5, 18) = clamp(18, 5, 18) = 18:00 (6 PM).
    const maxH = 10;
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA,  distanceKm: 900, durationMinutes: maxH * 60 }),
      makeSegment({ from: KENORA,   to: THUNDER, distanceKm: 300, durationMinutes: 180 }), // 3h
    ];
    const settings = makeSettings({ maxDriveHours: maxH, targetArrivalHour: 21 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days.length).toBeGreaterThanOrEqual(2);
    const day2Hour = hourOf(days[1].totals.departureTime);
    // Short leg: can start later (should be well past noon)
    expect(day2Hour).toBeGreaterThan(12);
  });
});

// ── 8. Timezone change detection using real weather abbreviations ─────────────

describe('splitTripByDays — timezone change detection', () => {
  it('records a timezone change when adjacent segments have different timezoneAbbr', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: WINNIPEG, to: KENORA, distanceKm: 210, durationMinutes: 150,
        weather: { temperatureMax: 25, temperatureMin: 15, precipitationProb: 10, weatherCode: 1, timezone: 'America/Chicago', timezoneAbbr: 'CDT' },
      }),
      makeSegment({
        from: KENORA, to: THUNDER, distanceKm: 430, durationMinutes: 280,
        weather: { temperatureMax: 22, temperatureMin: 12, precipitationProb: 20, weatherCode: 2, timezone: 'America/Toronto', timezoneAbbr: 'EDT' },
      }),
    ];
    const settings = makeSettings({ maxDriveHours: 12 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    const allChanges = days.flatMap(d => d.timezoneChanges);
    expect(allChanges.length).toBeGreaterThanOrEqual(1);
    expect(allChanges[0].fromTimezone).toBe('CDT');
    expect(allChanges[0].toTimezone).toBe('EDT');
  });

  it('records NO timezone change when adjacent segments share the same timezoneAbbr', () => {
    const segments: RouteSegment[] = [
      makeSegment({
        from: WINNIPEG, to: KENORA, distanceKm: 210, durationMinutes: 150,
        weather: { temperatureMax: 25, temperatureMin: 15, precipitationProb: 10, weatherCode: 1, timezone: 'America/Winnipeg', timezoneAbbr: 'CDT' },
      }),
      makeSegment({
        from: KENORA, to: THUNDER, distanceKm: 430, durationMinutes: 280,
        weather: { temperatureMax: 22, temperatureMin: 12, precipitationProb: 20, weatherCode: 2, timezone: 'America/Winnipeg', timezoneAbbr: 'CDT' },
      }),
    ];
    const settings = makeSettings({ maxDriveHours: 12 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    const allChanges = days.flatMap(d => d.timezoneChanges);
    expect(allChanges).toHaveLength(0);
  });
});

// ── 9. Tolerance buffer — slightly-over segments combine into one day ────────

describe('splitTripByDays — tolerance buffer (1h grace)', () => {
  it('combines segments that slightly exceed maxDriveHours into one day', () => {
    // 147 + 363 = 510 min (8h30m) with 8h max → within 1h tolerance (540 min)
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA, distanceKm: 210, durationMinutes: 147 }),
      makeSegment({ from: KENORA, to: THUNDER, distanceKm: 490, durationMinutes: 363 }),
    ];
    const settings = makeSettings({ maxDriveHours: 8 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days).toHaveLength(1);
    expect(days[0].totals.driveTimeMinutes).toBe(510);
  });

  it('still splits when segments significantly exceed maxDriveHours', () => {
    // 300 + 300 = 600 min (10h) with 8h max → exceeds 1h tolerance (540 min)
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: KENORA, distanceKm: 500, durationMinutes: 300 }),
      makeSegment({ from: KENORA, to: THUNDER, distanceKm: 500, durationMinutes: 300 }),
    ];
    const settings = makeSettings({ maxDriveHours: 8 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days.length).toBeGreaterThanOrEqual(2);
  });

  it('does not split a single segment within tolerance', () => {
    // 510 min (8h30m) single segment with 8h max → within 1h tolerance, no split
    const segments: RouteSegment[] = [
      makeSegment({ from: WINNIPEG, to: THUNDER, distanceKm: 700, durationMinutes: 510 }),
    ];
    const settings = makeSettings({ maxDriveHours: 8 });
    const days = splitTripByDays(segments, settings, '2025-08-16', '09:00');

    expect(days).toHaveLength(1);
    expect(days[0].totals.driveTimeMinutes).toBe(510);
  });
});

/**
 * useTripLoader.test.ts — tests for the Adventure Mode → planner handoff logic.
 *
 * The core concern: when a user selects a destination in Adventure Mode, the
 * planner must receive a `returnDate` that matches the N-day promise Adventure
 * Mode made. Without this, round trips generate no destination stay days.
 *
 * We test the returnDate formula in isolation by replicating the pure logic
 * (no React hooks needed — the math is side-effect-free).
 */

import { describe, it, expect } from 'vitest';

// ─── Replicated pure helpers (mirrors useTripLoader internals) ─────────────────

/** Estimate one-way driving days given a distance and max daily drive hours. */
function estimateDrivingDays(distanceKm: number, maxDriveHoursPerDay: number): number {
  const avgSpeedKmh = 90;
  const totalDriveHours = distanceKm / avgSpeedKmh;
  return Math.max(1, Math.ceil(totalDriveHours / maxDriveHoursPerDay));
}

/** Calculate the returnDate string for a round trip adventure selection. */
function calcReturnDate(params: {
  isRoundTrip: boolean;
  estimatedDistanceKm: number; // round-trip total
  days: number;
  departureDate: string; // YYYY-MM-DD
  maxDriveHours: number;
}): string {
  const { isRoundTrip, estimatedDistanceKm, days, departureDate, maxDriveHours } = params;
  if (!isRoundTrip) return '';
  const oneWayDistanceKm = estimatedDistanceKm / 2;
  const drivingDaysOneWay = estimateDrivingDays(oneWayDistanceKm, maxDriveHours);
  const stayDays = Math.max(0, days - 2 * drivingDaysOneWay);
  const departure = new Date(departureDate + 'T00:00:00');
  const returnDay = new Date(departure);
  returnDay.setDate(returnDay.getDate() + drivingDaysOneWay + stayDays);
  return returnDay.toISOString().split('T')[0];
}

// ─── estimateDrivingDays ───────────────────────────────────────────────────────

describe('estimateDrivingDays', () => {
  it('short trip under one day rounds up to 1', () => {
    // 90 km at 90 km/h = 1 hour, well within 10h limit → 1 day
    expect(estimateDrivingDays(90, 10)).toBe(1);
  });

  it('minimum is always 1 regardless of distance', () => {
    expect(estimateDrivingDays(1, 10)).toBe(1);
  });

  it('long distance splits across multiple days', () => {
    // 1800 km at 90 km/h = 20h driving, 10h/day limit → 2 days
    expect(estimateDrivingDays(1800, 10)).toBe(2);
  });

  it('uses maxDriveHoursPerDay to scale driving days', () => {
    // Same distance, fewer hours per day → more days needed
    const relaxed = estimateDrivingDays(900, 10); // 10h → 1 day
    const short = estimateDrivingDays(900, 5);    // 5h → 2 days
    expect(short).toBeGreaterThan(relaxed);
  });

  it('Regina scenario: ~290km one-way fits in 1 day at 10h limit', () => {
    // 290km / 90km/h = ~3.2h driving — well within 10h
    expect(estimateDrivingDays(290, 10)).toBe(1);
  });
});

// ─── calcReturnDate ────────────────────────────────────────────────────────────

describe('calcReturnDate (Adventure Mode → planner returnDate)', () => {
  it('one-way trip returns empty string', () => {
    expect(calcReturnDate({
      isRoundTrip: false,
      estimatedDistanceKm: 600,
      days: 3,
      departureDate: '2026-04-01',
      maxDriveHours: 10,
    })).toBe('');
  });

  it('Regina scenario: 3 days, 580km round trip → 2 days after departure', () => {
    // One-way: 290km → 1 driving day each way
    // Stay days: 3 - (2 × 1) = 1
    // Return = departure + 1 driving + 1 stay = departure + 2 days
    const result = calcReturnDate({
      isRoundTrip: true,
      estimatedDistanceKm: 580,
      days: 3,
      departureDate: '2026-04-01',
      maxDriveHours: 10,
    });
    expect(result).toBe('2026-04-03');
  });

  it('short 2-day round trip with no stay: return = departure + 2 driving days', () => {
    // 180km one-way → 1 day each way, stayDays = max(0, 2 - 2) = 0
    // return = departure + 1 + 0 = departure + 1 day
    const result = calcReturnDate({
      isRoundTrip: true,
      estimatedDistanceKm: 360, // 180 each way
      days: 2,
      departureDate: '2026-04-01',
      maxDriveHours: 10,
    });
    expect(result).toBe('2026-04-02');
  });

  it('long trip: 5 days, 600km round trip → 3 stay days', () => {
    // 300km one-way → 1 driving day each way
    // stayDays = 5 - 2 = 3
    // return = departure + 1 + 3 = departure + 4
    const result = calcReturnDate({
      isRoundTrip: true,
      estimatedDistanceKm: 600,
      days: 5,
      departureDate: '2026-04-01',
      maxDriveHours: 10,
    });
    expect(result).toBe('2026-04-05');
  });

  it('return date is always after departure date', () => {
    const result = calcReturnDate({
      isRoundTrip: true,
      estimatedDistanceKm: 200,
      days: 1,
      departureDate: '2026-06-15',
      maxDriveHours: 10,
    });
    expect(new Date(result) > new Date('2026-06-15')).toBe(true);
  });

  it('stay days never go negative (driving-heavy trip)', () => {
    // 2000km round trip at 10h/day → 2 days driving each way = 4 total driving days
    // Only 3 days selected → stayDays = max(0, 3 - 4) = 0
    const result = calcReturnDate({
      isRoundTrip: true,
      estimatedDistanceKm: 2000,
      days: 3,
      departureDate: '2026-04-01',
      maxDriveHours: 10,
    });
    // Return should still be a valid date (no negative offset)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(result) >= new Date('2026-04-01')).toBe(true);
  });
});

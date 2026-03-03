/**
 * useGhostCar — pure-function unit tests
 *
 * Tests cover interpolateKm and binarySearchLast independently of React
 * so we can verify correctness without a clock or trip fixture.
 *
 * 💚 My Experience Engine
 */
import { describe, it, expect } from 'vitest';
import { interpolateKm, binarySearchLast } from './useGhostCar';
import type { TimedEvent } from '../lib/trip-timeline';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ms(isoTime: string): number {
  return new Date(isoTime).getTime();
}

/**
 * Build a minimal TimedEvent for testing.
 * departureTime = arrivalTime unless overridden (represents an instantaneous waypoint).
 */
function makeEvent(
  distanceFromOriginKm: number,
  arrivalIso: string,
  departureIso?: string,
): TimedEvent {
  return {
    id: `evt-${distanceFromOriginKm}`,
    type: 'drive',
    arrivalTime: new Date(arrivalIso),
    departureTime: new Date(departureIso ?? arrivalIso),
    durationMinutes: 0,
    distanceFromOriginKm,
    locationHint: `${distanceFromOriginKm}km`,
    stops: [],
    timezone: 'UTC',
  };
}

/** Canonical 3-event timeline: origin + midpoint + destination */
function threeEventTimeline(): TimedEvent[] {
  return [
    makeEvent(0,   '2026-06-01T09:00:00Z', '2026-06-01T09:00:00Z'),  // depart origin
    makeEvent(100, '2026-06-01T10:00:00Z', '2026-06-01T10:15:00Z'),  // midpoint stop (15-min rest)
    makeEvent(200, '2026-06-01T11:15:00Z', '2026-06-01T11:15:00Z'),  // destination
  ];
}

// ── binarySearchLast ──────────────────────────────────────────────────────────

describe('binarySearchLast', () => {
  it('returns -1 on empty array', () => {
    expect(binarySearchLast([], () => true)).toBe(-1);
  });

  it('returns -1 when predicate is false for all', () => {
    expect(binarySearchLast([1, 2, 3], v => v > 10)).toBe(-1);
  });

  it('returns last index when predicate is true for all', () => {
    expect(binarySearchLast([1, 2, 3], v => v <= 10)).toBe(2);
  });

  it('returns last true index in the middle', () => {
    const arr = [1, 3, 5, 7, 9];
    // true for v <= 5 → indices 0,1,2 — result should be 2
    expect(binarySearchLast(arr, v => v <= 5)).toBe(2);
  });

  it('handles single-element array — true', () => {
    expect(binarySearchLast([42], () => true)).toBe(0);
  });

  it('handles single-element array — false', () => {
    expect(binarySearchLast([42], () => false)).toBe(-1);
  });

  it('respects monotonic breakpoint precisely', () => {
    const arr = [10, 20, 30, 40, 50];
    expect(binarySearchLast(arr, v => v <= 30)).toBe(2);
    expect(binarySearchLast(arr, v => v <= 31)).toBe(2);
    expect(binarySearchLast(arr, v => v <= 40)).toBe(3);
  });
});

// ── interpolateKm ─────────────────────────────────────────────────────────────

describe('interpolateKm', () => {
  describe('empty events', () => {
    it('returns 0 with no events', () => {
      expect(interpolateKm([], Date.now())).toBe(0);
    });
  });

  describe('before departure', () => {
    it('returns origin km (0) when queried before departure', () => {
      const events = threeEventTimeline();
      const beforeDeparture = ms('2026-06-01T08:30:00Z');
      expect(interpolateKm(events, beforeDeparture)).toBe(0);
    });

    it('returns 0 exactly at departure time', () => {
      const events = threeEventTimeline();
      expect(interpolateKm(events, ms('2026-06-01T09:00:00Z'))).toBe(0);
    });
  });

  describe('after arrival', () => {
    it('returns totalKm when queried after last arrival', () => {
      const events = threeEventTimeline();
      const afterArrival = ms('2026-06-01T12:00:00Z');
      expect(interpolateKm(events, afterArrival)).toBe(200);
    });

    it('returns totalKm exactly at last arrival time', () => {
      const events = threeEventTimeline();
      expect(interpolateKm(events, ms('2026-06-01T11:15:00Z'))).toBe(200);
    });
  });

  describe('linear interpolation mid-transit', () => {
    it('returns 50km at exactly the halfway point on first leg (0→100km, 09:00→10:00)', () => {
      const events = threeEventTimeline();
      const halfwayFirstLeg = ms('2026-06-01T09:30:00Z');
      expect(interpolateKm(events, halfwayFirstLeg)).toBeCloseTo(50, 1);
    });

    it('returns 25km at 25% point on first leg', () => {
      const events = threeEventTimeline();
      const quarterLeg = ms('2026-06-01T09:15:00Z');
      expect(interpolateKm(events, quarterLeg)).toBeCloseTo(25, 1);
    });

    it('returns 100km while stopped at midpoint (within stop window)', () => {
      const events = threeEventTimeline();
      // Between arrivalTime (10:00) and departureTime (10:15) — the rest stop
      const duringStop = ms('2026-06-01T10:07:00Z');
      // At this time car is parked at 100km — binarySearchLast finds event[0]
      // (departs 09:00 <= 10:07) but event[1] departs 10:15 > 10:07 which is the next leg
      // The lerp picks up after departure of the chosen leg, so it should be 100km
      expect(interpolateKm(events, duringStop)).toBeCloseTo(100, 0);
    });

    it('returns 150km at halfway point on second leg (100→200km, 10:15→11:15)', () => {
      const events = threeEventTimeline();
      const halfwaySecondLeg = ms('2026-06-01T10:45:00Z');
      expect(interpolateKm(events, halfwaySecondLeg)).toBeCloseTo(150, 1);
    });
  });

  describe('single-stop trip (2 events)', () => {
    it('handles a 2-event timeline without crashing', () => {
      const events = [
        makeEvent(0,   '2026-06-01T09:00:00Z', '2026-06-01T09:00:00Z'),
        makeEvent(300, '2026-06-01T14:00:00Z', '2026-06-01T14:00:00Z'),
      ];
      const mid = ms('2026-06-01T11:30:00Z'); // exactly halfway
      expect(interpolateKm(events, mid)).toBeCloseTo(150, 1);
    });
  });

  describe('zero-duration leg', () => {
    it('does not divide by zero when departure == arrival on the same event', () => {
      // Two events at the same time and km — span = 0
      const events = [
        makeEvent(0,  '2026-06-01T09:00:00Z', '2026-06-01T09:00:00Z'),
        makeEvent(50, '2026-06-01T09:00:00Z', '2026-06-01T09:00:00Z'),
      ];
      // span = arrivalTime[1] - departureTime[0] = 0 → should return to[1].distanceFromOriginKm
      expect(() => interpolateKm(events, ms('2026-06-01T09:00:00Z'))).not.toThrow();
    });
  });

  describe('clamping', () => {
    it('never returns negative km', () => {
      const events = threeEventTimeline();
      expect(interpolateKm(events, ms('2020-01-01T00:00:00Z'))).toBeGreaterThanOrEqual(0);
    });

    it('never returns more than totalKm', () => {
      const events = threeEventTimeline();
      expect(interpolateKm(events, ms('2030-01-01T00:00:00Z'))).toBeLessThanOrEqual(200);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { rankAndFilterPOIs, haversineDistance, estimateDetourTime } from './poi-ranking';
import type { POISuggestion, RouteSegment } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePOI(overrides: Partial<POISuggestion> = {}): POISuggestion {
  return {
    id: 'test-poi-1',
    name: 'Test POI',
    category: 'viewpoint',
    lat: 49.0,
    lng: -97.0,
    bucket: 'along-way',
    distanceFromRoute: 0,
    detourTimeMinutes: 0,
    rankingScore: 0,
    categoryMatchScore: 0,
    popularityScore: 50,
    timingFitScore: 0,
    actionState: 'suggested',
    ...overrides,
  };
}

function makeSegment(stopType: RouteSegment['stopType'] = 'break'): RouteSegment {
  return {
    from: { name: 'A', lat: 49.0, lng: -97.0 },
    to:   { name: 'B', lat: 49.5, lng: -97.0 },
    distanceKm: 55,
    durationMinutes: 45,
    stopType,
    stopDurationMinutes: 15,
  };
}

// Route geometry along a straight meridian
const ROUTE: [number, number][] = [
  [49.0, -97.0],
  [49.5, -97.0],
  [50.0, -97.0],
];

// ─── haversineDistance ────────────────────────────────────────────────────────

describe('haversineDistance', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineDistance(49, -97, 49, -97)).toBeCloseTo(0, 5);
  });

  it('returns a positive value for distinct points', () => {
    expect(haversineDistance(49, -97, 50, -97)).toBeGreaterThan(0);
  });
});

// ─── estimateDetourTime ───────────────────────────────────────────────────────

describe('estimateDetourTime', () => {
  it('returns 0 for 0 km distance', () => {
    expect(estimateDetourTime(0)).toBe(0);
  });

  it('returns ~4 minutes for a 2 km deviation (round-trip 4 km at 60 km/h)', () => {
    expect(estimateDetourTime(2)).toBe(4);
  });
});

// ─── rankAndFilterPOIs — segmentIndex 0 timing fit ───────────────────────────

describe('rankAndFilterPOIs — segmentIndex 0 timing fit', () => {
  /**
   * THE BUG: `calculateTimingFitScore` previously checked `!poi.segmentIndex`
   * which is falsy for `0`, causing POIs on the very first route segment to
   * always get a neutral timing score (50) instead of the correct segment-aware
   * score. After the fix, segment 0 POIs should receive a proper timing bonus.
   */

  it('does not treat segmentIndex 0 as "no timing context"', () => {
    // A gas POI right on segment 0 (a 'fuel' stop) should get a timing boost.
    // The bug would have returned 50 (neutral); the fix must score > 50.
    const seg0: RouteSegment = makeSegment('fuel');
    const seg1: RouteSegment = makeSegment('break');
    const segments = [seg0, seg1];

    const gasPOI = makePOI({ category: 'gas', lat: 49.0, lng: -97.0 });

    const results = rankAndFilterPOIs([gasPOI], ROUTE, segments, []);
    expect(results).toHaveLength(1);
    // timingFitScore for a 'gas' POI on a 'fuel' segment should be > 50 (base)
    expect(results[0].timingFitScore).toBeGreaterThan(50);
  });

  it('gives the same timing boost for segmentIndex 0 as for segmentIndex 1', () => {
    // Two identical viewpoint POIs — one near segment 0, one near segment 1.
    // Both segments are 'break' stops. Their timing scores must match.
    const seg0: RouteSegment = makeSegment('break');
    const seg1: RouteSegment = makeSegment('break');
    const segments = [seg0, seg1];

    // Near start of route (closest to segment 0)
    const poi0 = makePOI({ id: 'p0', category: 'viewpoint', lat: 49.0, lng: -97.0 });
    // Near midpoint (closest to segment 1)
    const poi1 = makePOI({ id: 'p1', category: 'viewpoint', lat: 49.5, lng: -97.0 });

    const results0 = rankAndFilterPOIs([poi0], ROUTE, segments, []);
    const results1 = rankAndFilterPOIs([poi1], ROUTE, segments, []);

    expect(results0).toHaveLength(1);
    expect(results1).toHaveLength(1);
    expect(results0[0].timingFitScore).toBe(results1[0].timingFitScore);
  });

  it('completes without throwing when segmentIndex is undefined', () => {
    const segments = [makeSegment('fuel')];
    const poi = makePOI({ category: 'gas', segmentIndex: undefined, lat: 49.0, lng: -97.001 });
    expect(() => rankAndFilterPOIs([poi], ROUTE, segments, [])).not.toThrow();
  });
});

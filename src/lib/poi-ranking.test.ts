import { describe, it, expect } from 'vitest';
import { rankAndFilterPOIs, rankDestinationPOIs, haversineDistance, estimateDetourTime, findNearestSegmentIndex } from './poi-ranking';
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
    from: { id: 'a', type: 'origin' as const, name: 'A', lat: 49.0, lng: -97.0 },
    to:   { id: 'b', type: 'destination' as const, name: 'B', lat: 49.5, lng: -97.0 },
    distanceKm: 55,
    durationMinutes: 45,
    stopType,
    fuelNeededLitres: 0,
    fuelCost: 0,
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

// ─── findNearestSegmentIndex ──────────────────────────────────────────────────

describe('findNearestSegmentIndex', () => {
  const segments = [
    makeSegment('break'),
    {
      from: { id: 'b', type: 'waypoint' as const, name: 'B', lat: 49.5, lng: -97.0 },
      to:   { id: 'c', type: 'destination' as const, name: 'C', lat: 50.0, lng: -97.0 },
      distanceKm: 55,
      durationMinutes: 45,
      stopType: 'break' as const,
      fuelNeededLitres: 0,
      fuelCost: 0,
    },
  ];

  it('returns 0 for a point nearest the first segment destination', () => {
    expect(findNearestSegmentIndex(49.5, -97.0, segments)).toBe(0);
  });

  it('returns 1 for a point nearest the second segment destination', () => {
    expect(findNearestSegmentIndex(50.0, -97.0, segments)).toBe(1);
  });

  it('returns 0 for a single-segment route', () => {
    expect(findNearestSegmentIndex(51.0, -95.0, [makeSegment()])).toBe(0);
  });
});

// ─── rankDestinationPOIs ──────────────────────────────────────────────────────

describe('rankDestinationPOIs', () => {
  const destination = { lat: 49.5, lng: -97.0 };

  it('returns at most topN results', () => {
    const pois = Array.from({ length: 10 }, (_, i) =>
      makePOI({ id: `dp-${i}`, lat: 49.5 + i * 0.01 })
    );
    const result = rankDestinationPOIs(pois, ['scenic'], destination, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('results are sorted by rankingScore descending', () => {
    const pois = [
      makePOI({ id: 'a', popularityScore: 20 }),
      makePOI({ id: 'b', popularityScore: 80 }),
      makePOI({ id: 'c', popularityScore: 50 }),
    ];
    const result = rankDestinationPOIs(pois, [], destination, 10);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].rankingScore).toBeLessThanOrEqual(result[i - 1].rankingScore);
    }
  });

  it('sets detourTimeMinutes to 0 (no detour — already at destination)', () => {
    const result = rankDestinationPOIs([makePOI()], [], destination, 10);
    result.forEach(p => expect(p.detourTimeMinutes).toBe(0));
  });

  it('sets fitsInBreakWindow to true for all', () => {
    const result = rankDestinationPOIs([makePOI()], [], destination, 10);
    result.forEach(p => expect(p.fitsInBreakWindow).toBe(true));
  });

  it('distanceFromRoute reflects distance from destination, not route polyline', () => {
    const poi = makePOI({ lat: 49.5 + 0.1, lng: -97.0 }); // ~11 km north
    const result = rankDestinationPOIs([poi], [], destination, 5);
    expect(result[0].distanceFromRoute).toBeGreaterThan(5);
    expect(result[0].distanceFromRoute).toBeLessThan(20);
  });

  it('returns empty array for empty input', () => {
    expect(rankDestinationPOIs([], ['scenic'], destination, 5)).toHaveLength(0);
  });
});

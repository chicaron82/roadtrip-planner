import { describe, it, expect } from 'vitest';
import { rankAndFilterPOIs, rankDestinationPOIs } from './poi-ranking';
import { haversineDistance, estimateDetourTime, findNearestSegmentIndex } from './geo-utils';
import type { POISuggestion, RouteSegment, TripPreference, TripSummary } from '../types';
import { buildJourneyContext } from './trip-orchestrator/journey-context';

function rankAndFilterPOIsWithContext(
  pois: POISuggestion[],
  routeGeometry: [number, number][],
  segments: RouteSegment[],
  tripPreferences: TripPreference[] = [],
  topN: number = 5
) {
  const mockTripSummary = {
    segments,
    days: [{ dayNumber: 1, segmentIndices: segments.map((_, i) => i) }]
  } as unknown as TripSummary;
  return rankAndFilterPOIs(pois, routeGeometry, segments, tripPreferences, topN, buildJourneyContext(mockTripSummary));
}

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

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return {
    from: { id: 'a', type: 'origin' as const, name: 'A', lat: 49.0, lng: -97.0 },
    to:   { id: 'b', type: 'destination' as const, name: 'B', lat: 49.5, lng: -97.0 },
    distanceKm: 55,
    durationMinutes: 45,
    stopType: 'break',
    fuelNeededLitres: 0,
    fuelCost: 0,
    ...overrides,
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

  it('uses actual driving speed when provided — highway driver pays less detour cost than backroad driver', () => {
    // 5 km off route, round trip 10 km
    // At 60 km/h: 10 minutes. At 110 km/h: ~5 minutes.
    expect(estimateDetourTime(5, 60)).toBe(10);
    expect(estimateDetourTime(5, 110)).toBe(5);
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
    const seg0: RouteSegment = makeSegment({ stopType: 'fuel' });
    const seg1: RouteSegment = makeSegment({ stopType: 'break' });
    const segments = [seg0, seg1];

    const gasPOI = makePOI({ category: 'gas', lat: 49.0, lng: -97.0 });

    const results = rankAndFilterPOIsWithContext([gasPOI], ROUTE, segments, []);
    expect(results).toHaveLength(1);
    // timingFitScore for a 'gas' POI on a 'fuel' segment should be > 50 (base)
    expect(results[0].timingFitScore).toBeGreaterThan(50);
  });

  it('gives the same timing boost for segmentIndex 0 as for segmentIndex 1', () => {
    // Two identical viewpoint POIs — one near segment 0, one near segment 1.
    // Both segments are 'break' stops. Their timing scores must match.
    const seg0: RouteSegment = makeSegment({ stopType: 'break' });
    const seg1: RouteSegment = makeSegment({ stopType: 'break' });
    const segments = [seg0, seg1];

    // Near start of route (closest to segment 0)
    const poi0 = makePOI({ id: 'p0', category: 'viewpoint', lat: 49.0, lng: -97.0 });
    // Near midpoint (closest to segment 1)
    const poi1 = makePOI({ id: 'p1', category: 'viewpoint', lat: 49.5, lng: -97.0 });

    const results0 = rankAndFilterPOIsWithContext([poi0], ROUTE, segments, []);
    const results1 = rankAndFilterPOIsWithContext([poi1], ROUTE, segments, []);

    expect(results0).toHaveLength(1);
    expect(results1).toHaveLength(1);
    expect(results0[0].timingFitScore).toBe(results1[0].timingFitScore);
  });

  it('completes without throwing when segmentIndex is undefined', () => {
    const segments = [makeSegment({ stopType: 'fuel' })];
    const poi = makePOI({ category: 'gas', segmentIndex: undefined, lat: 49.0, lng: -97.001 });
    expect(() => rankAndFilterPOIsWithContext([poi], ROUTE, segments, [])).not.toThrow();
  });
});

// ─── findNearestSegmentIndex ──────────────────────────────────────────────────

describe('findNearestSegmentIndex', () => {
  const segments = [
    makeSegment({ stopType: 'break' }),
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

// ─── Weather-Aware Ranking ────────────────────────────────────────────────────

describe('Weather-Aware Ranking', () => {
  const ROUTE_STRAIGHT: [number, number][] = [[40, -70], [41, -70]];
  const segments = [makeSegment()];

  it('penalizes outdoor POIs during rain', () => {
    const rainyViewpoint = makePOI({
      category: 'viewpoint',
      lat: 40.5,
      lng: -70.0,
      weather: {
        weatherCode: 61, // Slight rain
        temperatureMax: 20,
        temperatureMin: 10,
        precipitationProb: 80,
        timezone: 'UTC',
        timezoneAbbr: 'UTC',
      }
    });

    const results = rankAndFilterPOIsWithContext([rainyViewpoint], ROUTE_STRAIGHT, segments, []);
    expect(results[0].weatherFitScore).toBe(10);
    expect(results[0].rankingRationale).toContain('rain');
  });

  it('boosts indoor POIs during rain', () => {
    const rainyMuseum = makePOI({
      category: 'museum',
      lat: 40.5,
      lng: -70.0,
      weather: {
        weatherCode: 61,
        temperatureMax: 20,
        temperatureMin: 10,
        precipitationProb: 80,
        timezone: 'UTC',
        timezoneAbbr: 'UTC',
      }
    });

    const results = rankAndFilterPOIsWithContext([rainyMuseum], ROUTE_STRAIGHT, segments, []);
    expect(results[0].weatherFitScore).toBe(80);
    expect(results[0].rankingRationale).toContain('indoor');
  });

  it('penalizes outdoor POIs during extreme heat', () => {
    const hotPark = makePOI({
      category: 'park',
      lat: 40.5,
      lng: -70.0,
      weather: {
        weatherCode: 0, // Clear
        temperatureMax: 40, // Extreme heat
        temperatureMin: 25,
        precipitationProb: 0,
        timezone: 'UTC',
        timezoneAbbr: 'UTC',
      }
    });

    const results = rankAndFilterPOIsWithContext([hotPark], ROUTE_STRAIGHT, segments, []);
    expect(results[0].weatherFitScore).toBeLessThanOrEqual(30);
    expect(results[0].rankingRationale).toContain('heat');
  });

  it('boosts viewpoints and waterfalls during clear weather', () => {
    const clearViewpoint = makePOI({
      category: 'viewpoint',
      lat: 40.5,
      lng: -70.0,
      weather: {
        weatherCode: 0, // Clear
        temperatureMax: 22,
        temperatureMin: 12,
        precipitationProb: 0,
        timezone: 'UTC',
        timezoneAbbr: 'UTC',
      }
    });

    const results = rankAndFilterPOIsWithContext([clearViewpoint], ROUTE_STRAIGHT, segments, []);
    expect(results[0].weatherFitScore).toBe(90);
    expect(results[0].rankingRationale).toContain('Perfect conditions');
  });

  it('affects the final ranking order based on weather', () => {
    // In clear weather, viewpoint (scenic) should win over museum.
    // In rain, museum should win over viewpoint.
    const viewpoint = makePOI({ id: 'v', category: 'viewpoint', lat: 40.5, lng: -70.0, popularityScore: 50 });
    const museum = makePOI({ id: 'm', category: 'museum', lat: 40.5, lng: -70.0, popularityScore: 50 });

    const clearWeather = {
      weatherCode: 0,
      temperatureMax: 20,
      temperatureMin: 10,
      precipitationProb: 0,
      timezone: 'America/Winnipeg',
      timezoneAbbr: 'CST'
    };
    const rainyWeather = {
      weatherCode: 61,
      temperatureMax: 15,
      temperatureMin: 5,
      precipitationProb: 90,
      timezone: 'America/Winnipeg',
      timezoneAbbr: 'CST'
    };

    const clearResults = rankAndFilterPOIsWithContext(
      [
        { ...viewpoint, weather: clearWeather },
        { ...museum, weather: clearWeather }
      ],
      ROUTE_STRAIGHT, segments, []
    );
    expect(clearResults[0].id).toBe('v');

    const rainyResults = rankAndFilterPOIsWithContext(
      [
        { ...viewpoint, weather: rainyWeather },
        { ...museum, weather: rainyWeather }
      ],
      ROUTE_STRAIGHT, segments, []
    );
    expect(rainyResults[0].id).toBe('m');
  });
});

// ─── Predictive Empathy ───────────────────────────────────────────────────────

describe('Predictive Empathy', () => {

  it('boosts POIs when the driver is fatigued (> 2.5h)', () => {
    // 3 hours of continuous driving
    const segments = [
      makeSegment({ durationMinutes: 180, stopType: 'drive' }),
      makeSegment({ durationMinutes: 60, stopType: 'break' }), // This is the segment the POI is near
    ];
    
    // A regular cafe should usually have a negative category boost, 
    // but fatigue should give it a net boost.
    const cafe = makePOI({ 
      id: 'c', 
      category: 'cafe', 
      lat: 41.5, 
      lng: -70.0,
      popularityScore: 10 // Low popularity
    });

    const results = rankAndFilterPOIsWithContext([cafe], [[40,-70], [41,-70], [42,-70]], segments, []);
    expect(results[0].rankingRationale).toContain('time for a quick legs-stretch');
    // base cafe category score is ~20 (30 - 10). Fatigue adds +20.
    // popularity 10 * 0.2 = 2. timingFit 50 * 0.15 = 7.5. detour 100 * 0.25 = 25.
    // Total should be around 40-60 range.
    expect(results[0].rankingScore).toBeGreaterThan(40);
  });

  it('applies a heavy warning and small penalty for late arrival at destination', () => {
    const destinationArrival = '2026-03-29T03:30:00Z'; // Pushes to late night regardless of US timezone
    const segments = [
      makeSegment({ arrivalTime: destinationArrival, stopType: 'overnight' })
    ];

    const legendarySpot = makePOI({
      id: 'legend',
      category: 'viewpoint',
      lat: 40.5,
      lng: -70.0,
      popularityScore: 90, // Legendary
      detourTimeMinutes: 20, // Pushes arrival to 10:50 PM
    });

    const results = rankAndFilterPOIsWithContext([legendarySpot], [[40,-70], [40.5,-70]], segments, []);
    expect(results[0].rankingRationale).toContain('Worth the late check-in?');
    // Penalty for legendary should be small (5), so it still ranks high.
    expect(results[0].rankingScore).toBeGreaterThan(40);
  });

  it('penalizes regular spots more heavily for late arrivals', () => {
    const destinationArrival = '2026-03-29T03:30:00Z';
    const segments = [
      makeSegment({ arrivalTime: destinationArrival, stopType: 'overnight' })
    ];

    const regularSpot = makePOI({
      id: 'regular',
      category: 'shopping',
      lat: 40.5,
      lng: -70.0,
      popularityScore: 30, // Regular
      detourTimeMinutes: 20, // Pushes arrival to 10:50 PM
    });

    const results = rankAndFilterPOIsWithContext([regularSpot], [[40,-70], [40.5,-70]], segments, []);
    expect(results[0].rankingRationale).toContain('Worth the late check-in?');
    // Penalty for regular should be higher (25).
    expect(results[0].rankingScore).toBeLessThan(50);
  });
});

// ─── The Legendary Engine ────────────────────────────────────────────────────

describe('The Legendary Engine — Timeline Protection', () => {
  it('skips heavy detours when the cumulative budget is near its limit', () => {
    // MAX_TOTAL_DETOUR = 50. 
    // Alpha (-97.25 lng) -> ~18km off -97.0 -> ~37m detour.
    // Beta (-97.15 lng) -> ~11km off -97.0 -> ~22m detour.
    // Gamma (-97.10 lng) -> ~7km off -97.0 -> ~14m detour.
    
    const stopAlpha = makePOI({ id: 'alpha', name: 'Alpha', lat: 40.5, lng: -70.23, popularityScore: 1000 });
    const stopBeta = makePOI({ id: 'beta', name: 'Beta', lat: 40.5, lng: -70.235, popularityScore: 80 });
    const stopGamma = makePOI({ id: 'gamma', name: 'Gamma', lat: 40.5, lng: -70.08, popularityScore: 50 });

    const LOCAL_ROUTE: [number, number][] = [[40, -70], [41, -70]];
    // distanceKm/durationMinutes set to give exactly 60 km/h so detour estimates
    // land at the expected budget boundaries (Alpha ~39m, Beta ~40m, Gamma ~14m).
    const localSegments = [makeSegment({
      from: { id: 'o', type: 'origin' as const, name: 'O', lat: 40.0, lng: -70.0 },
      to:   { id: 'd', type: 'destination' as const, name: 'D', lat: 41.0, lng: -70.0 },
      distanceKm: 60,
      durationMinutes: 60,
    })];

    const results = rankAndFilterPOIsWithContext([stopAlpha, stopBeta, stopGamma], LOCAL_ROUTE, localSegments, [], 5);
    
    expect(results.map(r => r.id)).toContain('alpha');
    expect(results.map(r => r.id)).not.toContain('beta'); // Pruned because it's heavy and over budget
    expect(results.map(r => r.id)).toContain('gamma'); // Included because it's "Quick" enough (<15)
    
    const gammaResult = results.find(r => r.id === 'gamma');
    expect(gammaResult?.rankingRationale).toContain('Timeline Protected');
  });

  it('never prunes a Golden Hour Guardian', () => {
    // Even if over budget, a Golden Hour viewpoint should stay.
    const stop1 = makePOI({ id: 's1', lat: 49.25, lng: -97.25, popularityScore: 80 }); // 37 mins
    const guardian = makePOI({ 
      id: 'guardian', 
      name: 'Guardian',
      category: 'viewpoint', 
      lat: 49.25, 
      lng: -97.20, // 30 mins
      isGoldenHour: true,
      popularityScore: 10 // Normally wouldn't make the cut
    });

    const results = rankAndFilterPOIsWithContext([stop1, guardian], ROUTE, [makeSegment()], [], 5);
    expect(results.map(r => r.id)).toContain('guardian');
  });
});

/**
 * poi-service — Test suite
 *
 * Covers all pure functions across:
 * - query-builder.ts (Overpass QL generation)
 * - geo.ts (bbox, haversine, sampling)
 * - cache.ts (route key hashing)
 * - poi-converter.ts (OSM → POISuggestion conversion)
 * - overpass.ts (fetch wrapper, via mocked fetch)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { buildCorridorQuery, buildParkRelationQuery, buildBucketAroundQuery, buildDestinationQuery } from './query-builder';
import { computeRouteBbox, estimateRouteDistanceKm, haversineDistanceSimple, sampleRouteByKm } from './geo';
import { hashRouteKey } from './cache';
import {
  deduplicatePOIs,
  overpassElementToPOI,
  determineCategoryFromTags,
  calculatePopularityScore,
  getRelevantCategories,
} from './poi-converter';
import { executeOverpassQuery } from './overpass';
import type { POISuggestion } from '../../types';
import type { OverpassElement } from './types';

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makeElement(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 1,
    lat: 49.8,
    lon: -97.1,
    tags: {
      name: 'Test Place',
      tourism: 'attraction',
    },
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<POISuggestion> = {}): POISuggestion {
  return {
    id: 'osm-node-1',
    name: 'Test',
    category: 'attraction',
    lat: 49.0,
    lng: -97.0,
    bucket: 'along-way',
    distanceFromRoute: 0,
    detourTimeMinutes: 0,
    rankingScore: 50,
    categoryMatchScore: 0,
    popularityScore: 50,
    timingFitScore: 0,
    actionState: 'suggested',
    osmType: 'node',
    osmId: '1',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCorridorQuery', () => {
  it('returns a valid Overpass QL string', () => {
    const q = buildCorridorQuery('49.0,-97.5,50.0,-96.5', ['viewpoint', 'attraction']);
    expect(q).toContain('[out:json]');
    expect(q).toContain('[timeout:45]');
    expect(q).toContain('out center');
  });

  it('includes node and way queries for each category', () => {
    const q = buildCorridorQuery('49.0,-97.5,50.0,-96.5', ['viewpoint']);
    expect(q).toContain('node["tourism"="viewpoint"]');
    expect(q).toContain('way["tourism"="viewpoint"]');
  });

  it('embeds the bbox in the query', () => {
    const bbox = '48.5,-98.0,50.5,-96.0';
    const q = buildCorridorQuery(bbox, ['attraction']);
    expect(q).toContain(bbox);
  });

  it('handles multiple categories', () => {
    const q = buildCorridorQuery('49.0,-97.5,50.0,-96.5', ['viewpoint', 'park', 'landmark']);
    expect(q).toContain('viewpoint');
    expect(q).toContain('nature_reserve');
    expect(q).toContain('historic');
  });

  it('does NOT include relation queries (bbox relation queries timeout)', () => {
    const q = buildCorridorQuery('49.0,-97.5,50.0,-96.5', ['park']);
    expect(q).not.toMatch(/relation\["boundary"/);
  });
});

describe('buildParkRelationQuery', () => {
  it('returns valid Overpass QL with relation queries', () => {
    const q = buildParkRelationQuery([[49.0, -97.0], [50.0, -96.0]]);
    expect(q).toContain('[out:json]');
    expect(q).toContain('relation["boundary"="protected_area"]["name"]');
    expect(q).toContain('out center');
  });

  it('creates one around: clause per sample point', () => {
    const q = buildParkRelationQuery([[49.0, -97.0], [50.0, -96.0], [51.0, -95.0]]);
    const matches = q.match(/around:/g);
    expect(matches).toHaveLength(3);
  });

  it('uses default 20km radius', () => {
    const q = buildParkRelationQuery([[49.0, -97.0]]);
    expect(q).toContain('around:20000');
  });

  it('respects custom radius', () => {
    const q = buildParkRelationQuery([[49.0, -97.0]], 10000);
    expect(q).toContain('around:10000');
  });
});

describe('buildBucketAroundQuery', () => {
  it('produces Overpass QL with around: clauses', () => {
    const q = buildBucketAroundQuery([[49.0, -97.0]], 5000, ['viewpoint']);
    expect(q).toContain('[out:json]');
    expect(q).toContain(`around:5000,49,${-97}`);
  });

  it('includes node and way for each sample-point / category combo', () => {
    const q = buildBucketAroundQuery([[49.0, -97.0]], 5000, ['viewpoint']);
    expect(q).toContain('node["tourism"="viewpoint"]');
    expect(q).toContain('way["tourism"="viewpoint"]');
  });

  it('handles multiple sample points', () => {
    const q = buildBucketAroundQuery([[49.0, -97.0], [50.0, -96.0]], 5000, ['attraction']);
    const matches = q.match(/around:/g);
    // 2 points × 1 category (attraction has 1 tag) × 2 (node+way) = 4 clauses
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });
});

describe('buildDestinationQuery', () => {
  const dest = { id: 'dest', name: 'Winnipeg', lat: 49.8954, lng: -97.1385, type: 'destination' as const };

  it('returns valid Overpass QL', () => {
    const q = buildDestinationQuery(dest, ['viewpoint'], 50000);
    expect(q).toContain('[out:json]');
    expect(q).toContain('out center');
  });

  it('includes node, way, and relation queries (destination can be a relation)', () => {
    const q = buildDestinationQuery(dest, ['park'], 50000);
    expect(q).toContain('node');
    expect(q).toContain('way');
    expect(q).toContain('relation');
  });

  it('embeds destination coords in the query', () => {
    const q = buildDestinationQuery(dest, ['attraction'], 50000);
    expect(q).toContain(`${dest.lat}`);
    expect(q).toContain(`${dest.lng}`);
  });

  it('embeds the radius', () => {
    const q = buildDestinationQuery(dest, ['viewpoint'], 30000);
    expect(q).toContain('30000');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GEO
// ─────────────────────────────────────────────────────────────────────────────

describe('haversineDistanceSimple', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistanceSimple(49.0, -97.0, 49.0, -97.0)).toBe(0);
  });

  it('Winnipeg to Brandon is ~200 km', () => {
    // Winnipeg: 49.8954, -97.1385 | Brandon: 49.8480, -99.9499
    const km = haversineDistanceSimple(49.8954, -97.1385, 49.8480, -99.9499);
    expect(km).toBeGreaterThan(190);
    expect(km).toBeLessThan(215);
  });

  it('is symmetric', () => {
    const ab = haversineDistanceSimple(49.0, -97.0, 50.0, -98.0);
    const ba = haversineDistanceSimple(50.0, -98.0, 49.0, -97.0);
    expect(ab).toBeCloseTo(ba, 6);
  });
});

describe('estimateRouteDistanceKm', () => {
  it('returns 0 for empty geometry', () => {
    expect(estimateRouteDistanceKm([])).toBe(0);
  });

  it('returns 0 for single-point geometry', () => {
    expect(estimateRouteDistanceKm([[49.0, -97.0]])).toBe(0);
  });

  it('total distance is sum of segment haversines', () => {
    const pts: [number, number][] = [[49.0, -97.0], [49.5, -97.5], [50.0, -98.0]];
    const total = estimateRouteDistanceKm(pts);
    const seg1 = haversineDistanceSimple(49.0, -97.0, 49.5, -97.5);
    const seg2 = haversineDistanceSimple(49.5, -97.5, 50.0, -98.0);
    expect(total).toBeCloseTo(seg1 + seg2, 6);
  });
});

describe('computeRouteBbox', () => {
  const route: [number, number][] = [
    [49.0, -97.0],
    [50.0, -96.0],
    [49.5, -97.5],
  ];

  it('returns a string in S,W,N,E format', () => {
    const bbox = computeRouteBbox(route, 10);
    const parts = bbox.split(',');
    expect(parts).toHaveLength(4);
  });

  it('south < north', () => {
    const parts = computeRouteBbox(route, 10).split(',').map(Number);
    const [south, , north] = parts;
    expect(north).toBeGreaterThan(south);
  });

  it('west < east', () => {
    const parts = computeRouteBbox(route, 10).split(',').map(Number);
    const [, west, , east] = parts;
    expect(east).toBeGreaterThan(west);
  });

  it('buffer expands the bbox', () => {
    const tight = computeRouteBbox(route, 0).split(',').map(Number);
    const wide = computeRouteBbox(route, 50).split(',').map(Number);
    expect(wide[0]).toBeLessThan(tight[0]);   // south smaller
    expect(wide[2]).toBeGreaterThan(tight[2]); // north larger
  });
});

describe('sampleRouteByKm', () => {
  it('returns empty array for empty geometry', () => {
    expect(sampleRouteByKm([], 50)).toEqual([]);
  });

  it('always includes the first point', () => {
    const route: [number, number][] = [[49.0, -97.0], [50.0, -98.0]];
    const samples = sampleRouteByKm(route, 10);
    expect(samples[0]).toEqual([49.0, -97.0]);
  });

  it('respects maxSamples limit', () => {
    const route: [number, number][] = Array.from({ length: 100 }, (_, i) => [49 + i * 0.05, -97.0] as [number, number]);
    const samples = sampleRouteByKm(route, 5, 8);
    expect(samples.length).toBeLessThanOrEqual(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────

describe('hashRouteKey', () => {
  const geo: [number, number][] = [[49.0, -97.0], [50.0, -96.0]];
  const dest = { id: 'd', name: 'Dest', lat: 50.0, lng: -96.0, type: 'destination' as const };

  it('returns a non-empty string', () => {
    expect(hashRouteKey(geo, dest, [])).toBeTruthy();
  });

  it('same inputs produce same key', () => {
    const k1 = hashRouteKey(geo, dest, ['scenic']);
    const k2 = hashRouteKey(geo, dest, ['scenic']);
    expect(k1).toBe(k2);
  });

  it('different destination produces different key', () => {
    const dest2 = { ...dest, lat: 51.0, lng: -95.0 };
    expect(hashRouteKey(geo, dest, [])).not.toBe(hashRouteKey(geo, dest2, []));
  });

  it('different preferences produce different key', () => {
    const k1 = hashRouteKey(geo, dest, ['scenic']);
    const k2 = hashRouteKey(geo, dest, ['foodie']);
    expect(k1).not.toBe(k2);
  });

  it('preferences are order-insensitive', () => {
    const k1 = hashRouteKey(geo, dest, ['scenic', 'foodie']);
    const k2 = hashRouteKey(geo, dest, ['foodie', 'scenic']);
    expect(k1).toBe(k2);
  });

  it('key contains :: separators', () => {
    const k = hashRouteKey(geo, dest, []);
    expect(k).toContain('::');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POI CONVERTER
// ─────────────────────────────────────────────────────────────────────────────

describe('determineCategoryFromTags', () => {
  it('returns viewpoint for tourism=viewpoint', () => {
    expect(determineCategoryFromTags({ tourism: 'viewpoint' })).toBe('viewpoint');
  });

  it('returns museum for tourism=museum', () => {
    expect(determineCategoryFromTags({ tourism: 'museum' })).toBe('museum');
  });

  it('returns landmark for historic tag', () => {
    expect(determineCategoryFromTags({ historic: 'monument' })).toBe('landmark');
  });

  it('returns waterfall for natural=waterfall', () => {
    expect(determineCategoryFromTags({ natural: 'waterfall' })).toBe('waterfall');
  });

  it('returns park for leisure=park', () => {
    expect(determineCategoryFromTags({ leisure: 'park' })).toBe('park');
  });

  it('returns gas for amenity=fuel', () => {
    expect(determineCategoryFromTags({ amenity: 'fuel' })).toBe('gas');
  });

  it('returns restaurant for amenity=restaurant', () => {
    expect(determineCategoryFromTags({ amenity: 'restaurant' })).toBe('restaurant');
  });

  it('returns null for unrecognised tags', () => {
    expect(determineCategoryFromTags({ power: 'tower' })).toBeNull();
  });

  it('returns null for empty tags', () => {
    expect(determineCategoryFromTags({})).toBeNull();
  });
});

describe('calculatePopularityScore', () => {
  it('base score is 50', () => {
    expect(calculatePopularityScore({})).toBe(50);
  });

  it('boosts score for tourism=attraction', () => {
    expect(calculatePopularityScore({ tourism: 'attraction' })).toBeGreaterThan(50);
  });

  it('wikipedia tag adds 10 points', () => {
    const base = calculatePopularityScore({});
    const withWiki = calculatePopularityScore({ wikipedia: 'en:Test' });
    expect(withWiki - base).toBe(10);
  });

  it('caps at 100', () => {
    const score = calculatePopularityScore({
      tourism: 'attraction',
      heritage: '1',
      wikipedia: 'en:Test',
      website: 'https://example.com',
      phone: '555-1234',
      opening_hours: 'Mo-Fr 09:00-17:00',
      description: 'A great place',
      stars: '5',
    });
    expect(score).toBe(100);
  });
});

describe('overpassElementToPOI', () => {
  it('converts a valid node element to POISuggestion', () => {
    const poi = overpassElementToPOI(makeElement());
    expect(poi).not.toBeNull();
    expect(poi!.name).toBe('Test Place');
    expect(poi!.lat).toBe(49.8);
    expect(poi!.lng).toBe(-97.1);
  });

  it('returns null when no coordinates', () => {
    const el = makeElement({ lat: undefined, lon: undefined });
    expect(overpassElementToPOI(el)).toBeNull();
  });

  it('returns null when no name', () => {
    const el = makeElement({ tags: { tourism: 'attraction' } });
    expect(overpassElementToPOI(el)).toBeNull();
  });

  it('returns null for unrecognised category', () => {
    const el = makeElement({ tags: { name: 'Power Tower', power: 'tower' } });
    expect(overpassElementToPOI(el)).toBeNull();
  });

  it('uses center coords for way elements', () => {
    const el = makeElement({
      type: 'way',
      lat: undefined,
      lon: undefined,
      center: { lat: 50.0, lon: -96.0 },
    });
    const poi = overpassElementToPOI(el);
    expect(poi).not.toBeNull();
    expect(poi!.lat).toBe(50.0);
    expect(poi!.lng).toBe(-96.0);
  });

  it('sets actionState to "suggested"', () => {
    const poi = overpassElementToPOI(makeElement());
    expect(poi!.actionState).toBe('suggested');
  });

  it('id is formatted as osm-type-id', () => {
    const poi = overpassElementToPOI(makeElement({ type: 'node', id: 42 }));
    expect(poi!.id).toBe('osm-node-42');
  });
});

describe('deduplicatePOIs', () => {
  it('removes duplicates by osmType + osmId', () => {
    const a = makeSuggestion({ id: 'osm-node-1', osmType: 'node', osmId: '1' });
    const b = makeSuggestion({ id: 'osm-node-1', osmType: 'node', osmId: '1', name: 'Duplicate' });
    const c = makeSuggestion({ id: 'osm-node-2', osmType: 'node', osmId: '2' });
    const result = deduplicatePOIs([a, b, c]);
    expect(result).toHaveLength(2);
  });

  it('keeps first occurrence', () => {
    const a = makeSuggestion({ id: 'osm-node-1', osmType: 'node', osmId: '1', name: 'First' });
    const b = makeSuggestion({ id: 'osm-node-1', osmType: 'node', osmId: '1', name: 'Second' });
    const result = deduplicatePOIs([a, b]);
    expect(result[0].name).toBe('First');
  });

  it('preserves order', () => {
    const pois = [
      makeSuggestion({ id: 'a', osmType: 'node', osmId: '1', name: 'A' }),
      makeSuggestion({ id: 'b', osmType: 'node', osmId: '2', name: 'B' }),
      makeSuggestion({ id: 'c', osmType: 'node', osmId: '3', name: 'C' }),
    ];
    const result = deduplicatePOIs(pois);
    expect(result.map(p => p.name)).toEqual(['A', 'B', 'C']);
  });

  it('returns empty array for empty input', () => {
    expect(deduplicatePOIs([])).toEqual([]);
  });

  it('different osmType with same id kept (node-1 ≠ way-1)', () => {
    const a = makeSuggestion({ id: 'osm-node-1', osmType: 'node', osmId: '1' });
    const b = makeSuggestion({ id: 'osm-way-1', osmType: 'way', osmId: '1' });
    const result = deduplicatePOIs([a, b]);
    expect(result).toHaveLength(2);
  });
});

describe('getRelevantCategories', () => {
  it('always includes viewpoint, landmark, waterfall', () => {
    const cats = getRelevantCategories([]);
    expect(cats).toContain('viewpoint');
    expect(cats).toContain('landmark');
    expect(cats).toContain('waterfall');
  });

  it('with no preferences also includes attraction and park', () => {
    const cats = getRelevantCategories([]);
    expect(cats).toContain('attraction');
    expect(cats).toContain('park');
  });

  it('with preferences adds relevant categories', () => {
    const cats = getRelevantCategories(['foodie']);
    expect(cats).toContain('restaurant');
    expect(cats).toContain('cafe');
  });

  it('deduplicates categories', () => {
    const cats = getRelevantCategories(['scenic', 'scenic']);
    const unique = new Set(cats);
    expect(cats.length).toBe(unique.size);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERPASS (fetch mocking)
// ─────────────────────────────────────────────────────────────────────────────

describe('executeOverpassQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns parsed elements on success', async () => {
    const mockElements = [{ type: 'node', id: 1, lat: 49.0, lon: -97.0 }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ elements: mockElements }),
    } as Response);

    const result = await executeOverpassQuery('[out:json]; node; out;');
    expect(result).toEqual(mockElements);
  });

  it('returns empty array when response has no elements', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    const result = await executeOverpassQuery('[out:json]; node; out;');
    expect(result).toEqual([]);
  });

  it('returns empty array on non-ok response after exhausting retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const promise = executeOverpassQuery('[out:json]; node; out;');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch throws after exhausting retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const promise = executeOverpassQuery('[out:json]; node; out;');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual([]);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    const mockElements = [{ type: 'node', id: 2, lat: 50.0, lon: -96.0 }];
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ elements: mockElements }) } as Response);

    const promise = executeOverpassQuery('[out:json]; node; out;');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual(mockElements);
  });
});

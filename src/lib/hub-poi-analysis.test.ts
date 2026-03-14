/**
 * hub-poi-analysis.ts — unit tests for analyzeForHub.
 *
 * Pure function (timestamps excluded from assertions) — no mocks needed.
 * Tests focus on the hub-detection threshold, radius tiers, city-name extraction,
 * and category filtering (only gas/hotel POIs count).
 */

import { describe, it, expect } from 'vitest';
import type { POISuggestion } from '../types';
import { analyzeForHub } from './hub-poi-analysis';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Base coords — Winnipeg. */
const HUB_LAT = 49.895;
const HUB_LNG = -97.138;

/** POI within 30km search radius of HUB. */
function makePOI(
  id: string,
  category: POISuggestion['category'] = 'gas',
  overrides: Partial<POISuggestion> = {},
): POISuggestion {
  return {
    id,
    name: `Place ${id}`,
    category,
    lat: HUB_LAT + (Math.random() - 0.5) * 0.1, // within ~5km
    lng: HUB_LNG + (Math.random() - 0.5) * 0.1,
    bucket: 'along-way',
    distanceFromRoute: 0.5,
    detourTimeMinutes: 5,
    rankingScore: 70,
    categoryMatchScore: 70,
    popularityScore: 60,
    timingFitScore: 65,
    actionState: 'suggested',
    address: 'Main St, Winnipeg, MB',
    ...overrides,
  };
}

/** Make N POIs near HUB with a city address. */
function makeHubPOIs(count: number, category: POISuggestion['category'] = 'gas'): POISuggestion[] {
  return Array.from({ length: count }, (_, i) => makePOI(`p${i}`, category));
}

// ─── analyzeForHub ────────────────────────────────────────────────────────────

describe('analyzeForHub — null guard (below threshold)', () => {
  it('returns null when fewer than 5 gas/hotel POIs are nearby', () => {
    const pois = makeHubPOIs(4); // 4 < MIN_POIS_FOR_HUB (5)
    expect(analyzeForHub(HUB_LAT, HUB_LNG, pois)).toBeNull();
  });

  it('returns null for empty POIs array', () => {
    expect(analyzeForHub(HUB_LAT, HUB_LNG, [])).toBeNull();
  });

  it('ignores non-gas/hotel categories (food, attraction, etc.)', () => {
    // 10 food POIs — should all be filtered out, leaving 0 qualifying POIs
    const pois = makeHubPOIs(10, 'restaurant');
    expect(analyzeForHub(HUB_LAT, HUB_LNG, pois)).toBeNull();
  });

  it('returns null when POIs are too far away (> 30km)', () => {
    // Offset 5 degrees lat ≈ 550km — well outside 30km radius
    const farPOIs = makeHubPOIs(10).map(p => ({ ...p, lat: p.lat + 5 }));
    expect(analyzeForHub(HUB_LAT, HUB_LNG, farPOIs)).toBeNull();
  });
});

describe('analyzeForHub — successful detection', () => {
  it('returns a DiscoveredHub when >= 5 gas/hotel POIs are nearby', () => {
    const pois = makeHubPOIs(5);
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois);
    expect(result).not.toBeNull();
  });

  it('hub has source = "discovered"', () => {
    const result = analyzeForHub(HUB_LAT, HUB_LNG, makeHubPOIs(5))!;
    expect(result.source).toBe('discovered');
  });

  it('hub has useCount = 0', () => {
    const result = analyzeForHub(HUB_LAT, HUB_LNG, makeHubPOIs(5))!;
    expect(result.useCount).toBe(0);
  });

  it('hub has poiCount matching the number of qualifying POIs', () => {
    const pois = [...makeHubPOIs(4, 'gas'), ...makeHubPOIs(3, 'hotel')]; // 7 qualifying
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois)!;
    expect(result.poiCount).toBe(7);
  });

  it('centroid lat/lng is within the area of the input POIs', () => {
    const pois = makeHubPOIs(5);
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois)!;
    // Centroid should be close to the hub coords (all POIs are within ~5km)
    expect(Math.abs(result.lat - HUB_LAT)).toBeLessThan(0.5);
    expect(Math.abs(result.lng - HUB_LNG)).toBeLessThan(0.5);
  });
});

describe('analyzeForHub — city name extraction', () => {
  it('extracts city name from addr:city tag when present', () => {
    const pois = Array.from({ length: 5 }, (_, i) =>
      makePOI(`t${i}`, 'gas', { tags: { 'addr:city': 'Winnipeg' }, address: undefined }),
    );
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois);
    expect(result?.name).toBe('Winnipeg');
  });

  it('falls back to address parsing when addr:city tag is absent', () => {
    // address "Main St, Winnipeg, MB" → second-to-last part = "Winnipeg"
    const pois = Array.from({ length: 5 }, (_, i) =>
      makePOI(`a${i}`, 'gas', { address: 'Main St, Winnipeg, MB' }),
    );
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois);
    expect(result?.name).toContain('Winnipeg');
  });

  it('returns null when no city name can be extracted', () => {
    // POIs with no address and no tags
    const pois = Array.from({ length: 5 }, (_, i) =>
      makePOI(`n${i}`, 'gas', { address: undefined, tags: undefined }),
    );
    // No city name → returns null even if enough POIs
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois);
    expect(result).toBeNull();
  });
});

describe('analyzeForHub — radius tiers', () => {
  it('assigns 25km radius for exactly 5 POIs (small hub)', () => {
    const pois = Array.from({ length: 5 }, (_, i) =>
      makePOI(`s${i}`, 'gas', { tags: { 'addr:city': 'Brandon' } }),
    );
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois)!;
    expect(result.radius).toBe(25);
  });

  it('assigns 40km radius for 10+ POIs (medium hub)', () => {
    const pois = Array.from({ length: 10 }, (_, i) =>
      makePOI(`m${i}`, 'gas', { tags: { 'addr:city': 'Calgary' } }),
    );
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois)!;
    expect(result.radius).toBe(40);
  });

  it('assigns 60km radius for 20+ POIs (major metro)', () => {
    const pois = Array.from({ length: 20 }, (_, i) =>
      makePOI(`b${i}`, 'gas', { tags: { 'addr:city': 'Toronto' } }),
    );
    const result = analyzeForHub(HUB_LAT, HUB_LNG, pois)!;
    expect(result.radius).toBe(60);
  });
});

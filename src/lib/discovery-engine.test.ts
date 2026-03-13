import { describe, it, expect } from 'vitest';
import type { POISuggestion } from '../types';
import {
  extractWikiUrl,
  discoverPOIs,
  filterByTimeBudget,
  getNobrainers,
  getTierCounts,
  totalDetourMinutes,
  TIER_META,
} from './discovery-engine';
import type { DiscoveredPOI } from './discovery-engine';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makePOI(overrides: Partial<POISuggestion> = {}): POISuggestion {
  return {
    id: 'poi-1',
    name: 'Test POI',
    category: 'attraction',
    lat: 49.0,
    lng: -97.0,
    bucket: 'along-way',
    distanceFromRoute: 5,
    detourTimeMinutes: 10,
    rankingScore: 75,
    categoryMatchScore: 70,
    popularityScore: 60,
    timingFitScore: 80,
    actionState: 'none',
    segmentIndex: 0,
    ...overrides,
  };
}

// ── extractWikiUrl ────────────────────────────────────────────────────────────

describe('extractWikiUrl', () => {
  it('returns null when tags is undefined', () => {
    expect(extractWikiUrl(undefined)).toBeNull();
  });

  it('returns null when tags is empty', () => {
    expect(extractWikiUrl({})).toBeNull();
  });

  it('returns direct HTTP url as-is', () => {
    const url = 'https://en.wikipedia.org/wiki/Giant_Nickel';
    expect(extractWikiUrl({ wikipedia: url })).toBe(url);
  });

  it('converts "en:Article Name" to Wikipedia URL', () => {
    const result = extractWikiUrl({ wikipedia: 'en:Giant Nickel' });
    expect(result).toBe('https://en.wikipedia.org/wiki/Giant_Nickel');
  });

  it('handles French Wikipedia tag', () => {
    const result = extractWikiUrl({ wikipedia: 'fr:Tour Eiffel' });
    expect(result).toContain('fr.wikipedia.org');
  });

  it('falls back to wikidata URL when no wikipedia tag', () => {
    const result = extractWikiUrl({ wikidata: 'Q12345' });
    expect(result).toBe('https://www.wikidata.org/wiki/Q12345');
  });

  it('prefers wikipedia over wikidata when both present', () => {
    const result = extractWikiUrl({ wikipedia: 'en:Giant Nickel', wikidata: 'Q12345' });
    expect(result).toContain('wikipedia.org');
    expect(result).not.toContain('wikidata.org');
  });

  it('URL-encodes special characters in article name', () => {
    const result = extractWikiUrl({ wikipedia: 'en:Banff National Park' });
    expect(result).toContain('Banff_National_Park');
  });
});

// ── TIER_META ─────────────────────────────────────────────────────────────────

describe('TIER_META', () => {
  it('has entries for all three tiers', () => {
    expect(TIER_META['no-brainer']).toBeDefined();
    expect(TIER_META['worth-detour']).toBeDefined();
    expect(TIER_META['if-time']).toBeDefined();
  });

  it('no-brainer has fire emoji', () => {
    expect(TIER_META['no-brainer'].emoji).toBe('🔥');
  });
});

// ── discoverPOIs — tier assignment ────────────────────────────────────────────

describe('discoverPOIs — tier assignment', () => {
  it('assigns no-brainer for score≥70 and detour≤15min', () => {
    const poi = makePOI({ rankingScore: 70, detourTimeMinutes: 15 });
    const result = discoverPOIs([poi]);
    expect(result[0].tier).toBe('no-brainer');
  });

  it('requires BOTH conditions for no-brainer (high score, detour=16 → worth-detour)', () => {
    const poi = makePOI({ rankingScore: 80, detourTimeMinutes: 16 });
    const result = discoverPOIs([poi]);
    expect(result[0].tier).not.toBe('no-brainer');
  });

  it('assigns worth-detour for score≥50', () => {
    const poi = makePOI({ rankingScore: 55, detourTimeMinutes: 30 });
    const result = discoverPOIs([poi]);
    expect(result[0].tier).toBe('worth-detour');
  });

  it('assigns worth-detour for detour≤10min regardless of score', () => {
    const poi = makePOI({ rankingScore: 20, detourTimeMinutes: 8 });
    const result = discoverPOIs([poi]);
    expect(result[0].tier).toBe('worth-detour');
  });

  it('assigns if-time for low score and high detour', () => {
    const poi = makePOI({ rankingScore: 30, detourTimeMinutes: 25 });
    const result = discoverPOIs([poi]);
    expect(result[0].tier).toBe('if-time');
  });

  it('filters out dismissed POIs', () => {
    const dismissed = makePOI({ actionState: 'dismissed' });
    const active = makePOI({ id: 'poi-2', actionState: 'none' });
    const result = discoverPOIs([dismissed, active]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('poi-2');
  });

  it('attaches wiki URL from tags', () => {
    const poi = makePOI({ tags: { wikipedia: 'en:Giant Nickel' } });
    const result = discoverPOIs([poi]);
    expect(result[0].wikiUrl).toContain('wikipedia.org');
  });

  it('wikiUrl is null when no tags', () => {
    const poi = makePOI({ tags: undefined });
    const result = discoverPOIs([poi]);
    expect(result[0].wikiUrl).toBeNull();
  });

  it('sorts by segmentIndex (route order, not score)', () => {
    const a = makePOI({ id: 'a', segmentIndex: 3, rankingScore: 90 });
    const b = makePOI({ id: 'b', segmentIndex: 1, rankingScore: 50 });
    const c = makePOI({ id: 'c', segmentIndex: 2, rankingScore: 70 });
    const result = discoverPOIs([a, b, c]);
    expect(result.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('handles empty input', () => {
    expect(discoverPOIs([])).toEqual([]);
  });
});

// ── filterByTimeBudget ────────────────────────────────────────────────────────

describe('filterByTimeBudget', () => {
  function makeDiscovered(overrides: Partial<DiscoveredPOI>): DiscoveredPOI {
    return {
      ...makePOI(),
      tier: 'worth-detour',
      wikiUrl: null,
      ...overrides,
    };
  }

  it('always includes no-brainers regardless of budget', () => {
    const nb = makeDiscovered({ id: 'nb', tier: 'no-brainer', detourTimeMinutes: 200 });
    const result = filterByTimeBudget([nb], 30);
    expect(result.map(p => p.id)).toContain('nb');
  });

  it('fits additional POIs within remaining budget after no-brainers', () => {
    const nb = makeDiscovered({ id: 'nb', tier: 'no-brainer', detourTimeMinutes: 20, segmentIndex: 0 });
    const other = makeDiscovered({ id: 'other', tier: 'worth-detour', detourTimeMinutes: 15, rankingScore: 60, segmentIndex: 1 });
    const result = filterByTimeBudget([nb, other], 40); // 40 - 20 = 20 remaining, other=15 fits
    expect(result.map(p => p.id)).toContain('other');
  });

  it('excludes POIs that exceed remaining budget', () => {
    const nb = makeDiscovered({ id: 'nb', tier: 'no-brainer', detourTimeMinutes: 30, segmentIndex: 0 });
    const big = makeDiscovered({ id: 'big', tier: 'worth-detour', detourTimeMinutes: 25, segmentIndex: 1 });
    const result = filterByTimeBudget([nb, big], 40); // 40 - 30 = 10 remaining, big=25 doesn't fit
    expect(result.map(p => p.id)).not.toContain('big');
  });

  it('picks highest-score optional POIs when multiple compete for budget', () => {
    const low = makeDiscovered({ id: 'low', tier: 'worth-detour', detourTimeMinutes: 20, rankingScore: 40, segmentIndex: 2 });
    const high = makeDiscovered({ id: 'high', tier: 'worth-detour', detourTimeMinutes: 20, rankingScore: 80, segmentIndex: 1 });
    const result = filterByTimeBudget([low, high], 25); // only room for one
    expect(result.map(p => p.id)).toContain('high');
    expect(result.map(p => p.id)).not.toContain('low');
  });

  it('re-sorts output by segment index', () => {
    const a = makeDiscovered({ id: 'a', tier: 'worth-detour', segmentIndex: 5, rankingScore: 90, detourTimeMinutes: 10 });
    const b = makeDiscovered({ id: 'b', tier: 'worth-detour', segmentIndex: 2, rankingScore: 60, detourTimeMinutes: 10 });
    const result = filterByTimeBudget([a, b], 60);
    expect(result[0].segmentIndex).toBeLessThan(result[1].segmentIndex!);
  });

  it('returns empty array for empty input', () => {
    expect(filterByTimeBudget([], 60)).toEqual([]);
  });
});

// ── getNobrainers ─────────────────────────────────────────────────────────────

describe('getNobrainers', () => {
  it('returns only no-brainer tier POIs', () => {
    const pois: DiscoveredPOI[] = [
      { ...makePOI({ id: 'nb' }), tier: 'no-brainer', wikiUrl: null },
      { ...makePOI({ id: 'wd' }), tier: 'worth-detour', wikiUrl: null },
      { ...makePOI({ id: 'it' }), tier: 'if-time', wikiUrl: null },
    ];
    const result = getNobrainers(pois);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nb');
  });

  it('returns empty array when no no-brainers', () => {
    const pois: DiscoveredPOI[] = [
      { ...makePOI(), tier: 'if-time', wikiUrl: null },
    ];
    expect(getNobrainers(pois)).toEqual([]);
  });
});

// ── getTierCounts ─────────────────────────────────────────────────────────────

describe('getTierCounts', () => {
  it('counts each tier correctly', () => {
    const pois: DiscoveredPOI[] = [
      { ...makePOI({ id: '1' }), tier: 'no-brainer', wikiUrl: null },
      { ...makePOI({ id: '2' }), tier: 'no-brainer', wikiUrl: null },
      { ...makePOI({ id: '3' }), tier: 'worth-detour', wikiUrl: null },
      { ...makePOI({ id: '4' }), tier: 'if-time', wikiUrl: null },
    ];
    const counts = getTierCounts(pois);
    expect(counts['no-brainer']).toBe(2);
    expect(counts['worth-detour']).toBe(1);
    expect(counts['if-time']).toBe(1);
  });

  it('returns zeros for empty input', () => {
    const counts = getTierCounts([]);
    expect(counts['no-brainer']).toBe(0);
    expect(counts['worth-detour']).toBe(0);
    expect(counts['if-time']).toBe(0);
  });
});

// ── totalDetourMinutes ────────────────────────────────────────────────────────

describe('totalDetourMinutes', () => {
  it('sums detour times correctly', () => {
    const pois: DiscoveredPOI[] = [
      { ...makePOI({ detourTimeMinutes: 15 }), tier: 'no-brainer', wikiUrl: null },
      { ...makePOI({ detourTimeMinutes: 20, id: 'b' }), tier: 'worth-detour', wikiUrl: null },
      { ...makePOI({ detourTimeMinutes: 5, id: 'c' }), tier: 'if-time', wikiUrl: null },
    ];
    expect(totalDetourMinutes(pois)).toBe(40);
  });

  it('returns 0 for empty array', () => {
    expect(totalDetourMinutes([])).toBe(0);
  });
});

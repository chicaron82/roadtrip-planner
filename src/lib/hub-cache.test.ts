import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  findKnownHub,
  findHubInWindow,
  resolveHubName,
  analyzeForHub,
  seedHubCache,
  cacheDiscoveredHub,
  clearHubCache,
  getHubCacheStats,
  type DiscoveredHub,
} from './hub-cache';
import type { POISuggestion } from '../types';

// ─── Mock localStorage ───────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _getStore: () => store,
  };
})();

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const FARGO: Omit<DiscoveredHub, 'lastUsed'> = {
  name: 'Fargo, ND',
  lat: 46.877,
  lng: -96.789,
  radius: 30,
  poiCount: 15,
  discoveredAt: '2026-01-01',
  source: 'seed',
};

const THUNDER_BAY: Omit<DiscoveredHub, 'lastUsed'> = {
  name: 'Thunder Bay, ON',
  lat: 48.382,
  lng: -89.246,
  radius: 30,
  poiCount: 12,
  discoveredAt: '2026-01-01',
  source: 'seed',
};

const DRYDEN: Omit<DiscoveredHub, 'lastUsed'> = {
  name: 'Dryden, ON',
  lat: 49.783,
  lng: -92.838,
  radius: 20,
  poiCount: 6,
  discoveredAt: '2026-01-01',
  source: 'seed',
};

function makePOI(category: 'gas' | 'hotel', lat: number, lng: number, city?: string): POISuggestion {
  return {
    id: `poi-${Math.random()}`,
    name: `Test ${category}`,
    category,
    lat,
    lng,
    distance: 0,
    address: city ? `123 Main St, ${city}, ON` : undefined,
    tags: city ? { 'addr:city': city } : undefined,
    // Required fields not used by analyzeForHub — stub with zero-values
    bucket: 'along-way',
    distanceFromRoute: 0,
    detourTimeMinutes: 0,
    rankingScore: 0,
    categoryMatchScore: 0,
    popularityScore: 0,
    timingFitScore: 0,
    actionState: 'suggested',
  } as POISuggestion;
}

// ─── Setup/Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock.clear();
  clearHubCache(); // Reset memory singleton
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─── seedHubCache ────────────────────────────────────────────────────────────

describe('seedHubCache', () => {
  it('adds seed hubs to empty cache', () => {
    seedHubCache([FARGO, THUNDER_BAY]);
    const stats = getHubCacheStats();
    expect(stats.totalHubs).toBe(2);
    expect(stats.seedHubs).toBe(2);
  });

  it('does not duplicate hubs within 20km proximity', () => {
    seedHubCache([FARGO]);
    // Try to seed a hub very close to Fargo
    const nearFargo = { ...FARGO, name: 'Near Fargo', lat: 46.88, lng: -96.79 };
    seedHubCache([nearFargo]);
    const stats = getHubCacheStats();
    expect(stats.totalHubs).toBe(1);
  });

  it('adds hubs that are far enough apart', () => {
    seedHubCache([FARGO]);
    seedHubCache([THUNDER_BAY]); // ~700km away
    const stats = getHubCacheStats();
    expect(stats.totalHubs).toBe(2);
  });
});

// ─── findKnownHub ────────────────────────────────────────────────────────────

describe('findKnownHub', () => {
  it('returns null when cache is empty', () => {
    expect(findKnownHub(46.877, -96.789)).toBeNull();
  });

  it('returns hub name when point is within hub radius', () => {
    seedHubCache([FARGO]);
    const result = findKnownHub(46.9, -96.8); // ~3km from Fargo center
    expect(result).toBe('Fargo, ND');
  });

  it('returns null when point is outside all hub radii', () => {
    seedHubCache([FARGO]);
    const result = findKnownHub(50.0, -100.0); // ~400km away
    expect(result).toBeNull();
  });

  it('updates lastUsed timestamp on cache hit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));

    seedHubCache([FARGO]);
    // Flush the async setTimeout(0) write
    await vi.runAllTimersAsync();
    localStorageMock.setItem.mockClear();

    vi.setSystemTime(new Date('2026-02-15T10:00:00Z'));
    findKnownHub(46.877, -96.789);

    // Flush the async setTimeout(0) write from the cache update
    await vi.runAllTimersAsync();

    // Check that localStorage.setItem was called (cache update)
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

// ─── findHubInWindow ─────────────────────────────────────────────────────────

describe('findHubInWindow', () => {
  it('returns null when cache is empty', () => {
    expect(findHubInWindow(46.877, -96.789)).toBeNull();
  });

  it('returns nearest hub within default 80km window', () => {
    seedHubCache([FARGO, THUNDER_BAY]);
    // Point 50km from Fargo
    const result = findHubInWindow(47.3, -96.789);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Fargo, ND');
  });

  it('returns null when no hub within window', () => {
    seedHubCache([FARGO]);
    // Point 200km from Fargo
    const result = findHubInWindow(48.5, -96.789);
    expect(result).toBeNull();
  });

  it('returns closest hub when multiple are in window', () => {
    seedHubCache([DRYDEN, THUNDER_BAY]);
    // Point roughly between them but closer to Thunder Bay
    const result = findHubInWindow(48.5, -90.0, 200);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Thunder Bay, ON');
  });

  it('respects custom windowKm parameter', () => {
    seedHubCache([FARGO]);
    // 60km from Fargo - outside 50km window, inside 80km window
    const inWindow = findHubInWindow(47.4, -96.789, 80);
    const outOfWindow = findHubInWindow(47.4, -96.789, 50);
    expect(inWindow).not.toBeNull();
    expect(outOfWindow).toBeNull();
  });
});

// ─── Memory Singleton Behavior ───────────────────────────────────────────────

describe('memory singleton', () => {
  it('loads from localStorage only once per session', () => {
    // Seed some data
    seedHubCache([FARGO]);
    localStorageMock.getItem.mockClear();

    // Multiple lookups should not hit localStorage again
    findKnownHub(46.877, -96.789);
    findKnownHub(48.382, -89.246);
    findKnownHub(49.783, -92.838);

    // getItem should not be called after initial load
    expect(localStorageMock.getItem).not.toHaveBeenCalled();
  });

  it('clears memory cache when clearHubCache is called', () => {
    seedHubCache([FARGO]);
    expect(findKnownHub(46.877, -96.789)).toBe('Fargo, ND');

    clearHubCache();
    expect(findKnownHub(46.877, -96.789)).toBeNull();
  });
});

// ─── cacheDiscoveredHub ──────────────────────────────────────────────────────

describe('cacheDiscoveredHub', () => {
  it('adds a newly discovered hub', () => {
    const newHub = {
      name: 'Brandon, MB',
      lat: 49.848,
      lng: -99.950,
      radius: 25,
      poiCount: 10,
      discoveredAt: '2026-02-01',
      source: 'discovered' as const,
    };
    cacheDiscoveredHub(newHub);
    const stats = getHubCacheStats();
    expect(stats.discoveredHubs).toBe(1);
  });

  it('does not duplicate hubs within 20km', () => {
    seedHubCache([FARGO]);
    const nearFargo = {
      name: 'West Fargo',
      lat: 46.87,
      lng: -96.9,
      radius: 20,
      poiCount: 5,
      discoveredAt: '2026-02-01',
      source: 'discovered' as const,
    };
    cacheDiscoveredHub(nearFargo);
    const stats = getHubCacheStats();
    expect(stats.totalHubs).toBe(1); // Not added
  });
});

// ─── analyzeForHub ───────────────────────────────────────────────────────────

describe('analyzeForHub', () => {
  it('returns null when fewer than 5 POIs nearby', () => {
    const pois = [
      makePOI('gas', 46.877, -96.789, 'Fargo'),
      makePOI('hotel', 46.878, -96.790, 'Fargo'),
    ];
    const result = analyzeForHub(46.877, -96.789, pois);
    expect(result).toBeNull();
  });

  it('detects hub when 5+ gas/hotel POIs are nearby', () => {
    const pois = [
      makePOI('gas', 46.877, -96.789, 'Fargo'),
      makePOI('gas', 46.878, -96.790, 'Fargo'),
      makePOI('hotel', 46.879, -96.791, 'Fargo'),
      makePOI('hotel', 46.880, -96.792, 'Fargo'),
      makePOI('gas', 46.881, -96.793, 'Fargo'),
    ];
    const result = analyzeForHub(46.877, -96.789, pois);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Fargo');
    expect(result!.source).toBe('discovered');
  });

  it('ignores POIs outside 30km search radius', () => {
    const pois = [
      makePOI('gas', 46.877, -96.789, 'Fargo'),
      makePOI('gas', 46.878, -96.790, 'Fargo'),
      // These are 100km+ away
      makePOI('hotel', 47.5, -96.0, 'Other'),
      makePOI('hotel', 47.6, -96.0, 'Other'),
      makePOI('gas', 47.7, -96.0, 'Other'),
    ];
    const result = analyzeForHub(46.877, -96.789, pois);
    expect(result).toBeNull(); // Only 2 nearby POIs
  });

  it('returns null when no city name can be extracted', () => {
    const pois = [
      { ...makePOI('gas', 46.877, -96.789), tags: undefined, address: undefined },
      { ...makePOI('gas', 46.878, -96.790), tags: undefined, address: undefined },
      { ...makePOI('hotel', 46.879, -96.791), tags: undefined, address: undefined },
      { ...makePOI('hotel', 46.880, -96.792), tags: undefined, address: undefined },
      { ...makePOI('gas', 46.881, -96.793), tags: undefined, address: undefined },
    ];
    const result = analyzeForHub(46.877, -96.789, pois);
    expect(result).toBeNull();
  });
});

// ─── resolveHubName ──────────────────────────────────────────────────────────

describe('resolveHubName', () => {
  it('returns cached hub name when available', () => {
    seedHubCache([FARGO]);
    const result = resolveHubName(46.877, -96.789);
    expect(result).toBe('Fargo, ND');
  });

  it('discovers hub from POI data when not in cache', () => {
    const pois = [
      makePOI('gas', 49.0, -97.0, 'Winnipeg'),
      makePOI('gas', 49.01, -97.01, 'Winnipeg'),
      makePOI('hotel', 49.02, -97.02, 'Winnipeg'),
      makePOI('hotel', 49.03, -97.03, 'Winnipeg'),
      makePOI('gas', 49.04, -97.04, 'Winnipeg'),
    ];
    const result = resolveHubName(49.0, -97.0, pois);
    expect(result).toBe('Winnipeg');
  });

  it('returns null when no hub found and no POI data', () => {
    const result = resolveHubName(50.0, -100.0);
    expect(result).toBeNull();
  });

  it('caches discovered hub for future lookups', () => {
    const pois = [
      makePOI('gas', 49.0, -97.0, 'Winnipeg'),
      makePOI('gas', 49.01, -97.01, 'Winnipeg'),
      makePOI('hotel', 49.02, -97.02, 'Winnipeg'),
      makePOI('hotel', 49.03, -97.03, 'Winnipeg'),
      makePOI('gas', 49.04, -97.04, 'Winnipeg'),
    ];

    // First call discovers and caches
    resolveHubName(49.0, -97.0, pois);

    // Second call should find it in cache (without POI data)
    const cached = resolveHubName(49.0, -97.0);
    expect(cached).toBe('Winnipeg');
  });
});

// ─── getHubCacheStats ────────────────────────────────────────────────────────

describe('getHubCacheStats', () => {
  it('returns zeros for empty cache', () => {
    const stats = getHubCacheStats();
    expect(stats.totalHubs).toBe(0);
    expect(stats.seedHubs).toBe(0);
    expect(stats.discoveredHubs).toBe(0);
    expect(stats.promotedHubs).toBe(0);
  });

  it('correctly counts seed vs discovered hubs', () => {
    seedHubCache([FARGO, THUNDER_BAY]);
    cacheDiscoveredHub({
      name: 'New Hub',
      lat: 45.0,
      lng: -75.0,
      radius: 25,
      poiCount: 8,
      discoveredAt: '2026-02-01',
      source: 'discovered',
    });

    const stats = getHubCacheStats();
    expect(stats.totalHubs).toBe(3);
    expect(stats.seedHubs).toBe(2);
    expect(stats.discoveredHubs).toBe(1);
    expect(stats.promotedHubs).toBe(0);
  });
});

// ─── TTL Expiry (90-day) ──────────────────────────────────────────────────────

describe('TTL expiry (90-day)', () => {
  it('prunes discovered hubs older than 90 days on save', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    cacheDiscoveredHub({
      name: 'Old Hub',
      lat: 45.0, lng: -75.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-01-01',
      source: 'discovered',
    });
    await vi.runAllTimersAsync();

    // Advance 91 days
    vi.setSystemTime(new Date('2026-04-02T00:00:00Z'));

    // Trigger a save by adding another hub
    cacheDiscoveredHub({
      name: 'New Hub',
      lat: 40.0, lng: -80.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-04-02',
      source: 'discovered',
    });

    const stats = getHubCacheStats();
    expect(stats.discoveredHubs).toBe(1); // Old Hub pruned
    expect(stats.totalHubs).toBe(1);
  });

  it('does NOT prune seed hubs regardless of age', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    seedHubCache([FARGO]);
    await vi.runAllTimersAsync();

    vi.setSystemTime(new Date('2027-01-01T00:00:00Z')); // 365 days later

    // Trigger a save
    cacheDiscoveredHub({
      name: 'Trigger Hub',
      lat: 40.0, lng: -80.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2027-01-01',
      source: 'discovered',
    });

    const stats = getHubCacheStats();
    expect(stats.seedHubs).toBe(1); // Fargo still there
  });

  it('does NOT prune promoted hubs regardless of age', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    cacheDiscoveredHub({
      name: 'Promoted City',
      lat: 45.0, lng: -75.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-01-01',
      source: 'discovered',
    });
    // Use it 3 times to promote
    findKnownHub(45.0, -75.0);
    findKnownHub(45.0, -75.0);
    findKnownHub(45.0, -75.0);
    await vi.runAllTimersAsync();

    expect(getHubCacheStats().promotedHubs).toBe(1);

    // Advance 91 days
    vi.setSystemTime(new Date('2026-04-02T00:00:00Z'));

    // Trigger save
    cacheDiscoveredHub({
      name: 'Trigger',
      lat: 40.0, lng: -80.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-04-02',
      source: 'discovered',
    });

    const stats = getHubCacheStats();
    expect(stats.promotedHubs).toBe(1); // Still there
  });

  it('keeps discovered hubs that were used within 90 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    cacheDiscoveredHub({
      name: 'Active Hub',
      lat: 45.0, lng: -75.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-01-01',
      source: 'discovered',
    });
    await vi.runAllTimersAsync();

    // Use it at day 80
    vi.setSystemTime(new Date('2026-03-22T00:00:00Z'));
    findKnownHub(45.0, -75.0);
    await vi.runAllTimersAsync();

    // Check at day 91 from original (but only 11 from last use)
    vi.setSystemTime(new Date('2026-04-02T00:00:00Z'));
    cacheDiscoveredHub({
      name: 'Trigger',
      lat: 40.0, lng: -80.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-04-02',
      source: 'discovered',
    });

    const stats = getHubCacheStats();
    expect(stats.discoveredHubs).toBe(2); // Both survive
  });
});

// ─── Hub Promotion ──────────────────────────────────────────────────────────

describe('hub promotion', () => {
  it('promotes discovered hub to promoted after 3 uses via findKnownHub', () => {
    cacheDiscoveredHub({
      name: 'Growing Hub',
      lat: 45.0, lng: -75.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-01-01',
      source: 'discovered',
    });

    expect(getHubCacheStats().discoveredHubs).toBe(1);
    expect(getHubCacheStats().promotedHubs).toBe(0);

    findKnownHub(45.0, -75.0); // use 1
    findKnownHub(45.0, -75.0); // use 2
    findKnownHub(45.0, -75.0); // use 3 — should promote

    expect(getHubCacheStats().discoveredHubs).toBe(0);
    expect(getHubCacheStats().promotedHubs).toBe(1);
  });

  it('promotes discovered hub via findHubInWindow', () => {
    cacheDiscoveredHub({
      name: 'Window Hub',
      lat: 45.0, lng: -75.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-01-01',
      source: 'discovered',
    });

    findHubInWindow(45.0, -75.0); // use 1
    findHubInWindow(45.0, -75.0); // use 2
    findHubInWindow(45.0, -75.0); // use 3

    expect(getHubCacheStats().promotedHubs).toBe(1);
  });

  it('does not promote seed hubs (already permanent)', () => {
    seedHubCache([FARGO]);

    findKnownHub(46.877, -96.789);
    findKnownHub(46.877, -96.789);
    findKnownHub(46.877, -96.789);

    expect(getHubCacheStats().seedHubs).toBe(1);
    expect(getHubCacheStats().promotedHubs).toBe(0);
  });

  it('handles legacy hubs without useCount field', () => {
    // Simulate legacy hub data (no useCount)
    const legacyHub = {
      name: 'Legacy Hub',
      lat: 45.0, lng: -75.0,
      radius: 25, poiCount: 8,
      discoveredAt: '2026-01-01',
      lastUsed: '2026-01-01',
      source: 'discovered',
      // intentionally no useCount
    };

    // clearHubCache resets memoryCache to null so next loadCache reads from localStorage
    clearHubCache();
    localStorage.setItem('roadtrip-discovered-hubs', JSON.stringify([legacyHub]));

    findKnownHub(45.0, -75.0); // use 1
    findKnownHub(45.0, -75.0); // use 2
    findKnownHub(45.0, -75.0); // use 3

    expect(getHubCacheStats().promotedHubs).toBe(1);
  });
});

// ─── findHubInWindow lastUsed Updates ───────────────────────────────────────

describe('findHubInWindow lastUsed updates', () => {
  it('updates lastUsed timestamp on cache hit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));

    seedHubCache([FARGO]);
    await vi.runAllTimersAsync();
    localStorageMock.setItem.mockClear();

    vi.setSystemTime(new Date('2026-02-15T10:00:00Z'));
    findHubInWindow(46.9, -96.8); // ~3km from Fargo

    await vi.runAllTimersAsync();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

// ─── saveCache Debounce ─────────────────────────────────────────────────────

describe('saveCache debounce', () => {
  it('coalesces rapid findHubInWindow calls into fewer localStorage writes', async () => {
    vi.useFakeTimers();
    seedHubCache([FARGO, THUNDER_BAY, DRYDEN]);
    await vi.runAllTimersAsync();
    localStorageMock.setItem.mockClear();

    // Rapid-fire lookups (simulating route calculation)
    findHubInWindow(46.9, -96.8);   // hits Fargo
    findHubInWindow(48.4, -89.3);   // hits Thunder Bay
    findHubInWindow(49.8, -92.8);   // hits Dryden

    // Only one write should happen (the last debounced timer)
    await vi.runAllTimersAsync();
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
  });
});

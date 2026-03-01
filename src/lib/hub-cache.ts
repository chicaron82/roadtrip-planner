/**
 * hub-cache.ts — Self-Learning Highway Hub Cache
 *
 * THE PROBLEM:
 * Fuel stops often land in sparse highway areas. Without city context,
 * they display as "515 km from Winnipeg" — useless for trip planning.
 * Nominatim can resolve coordinates to city names, but it's slow (300-500ms)
 * and rate-limited. On a 2000km route with 10+ fuel checks, that's 3-5 seconds
 * of blocking API calls.
 *
 * THE SOLUTION — 3-Tier Resolution:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │  Tier 1: CACHE HIT (instant, <1ms)                                         │
 * │    • Check if coordinates fall within any known hub's radius               │
 * │    • Pre-seeded with 130+ major highway corridor cities                    │
 * │    • Grows over time via runtime discovery                                 │
 * ├────────────────────────────────────────────────────────────────────────────┤
 * │  Tier 2: POI ANALYSIS (fast, uses already-fetched data)                    │
 * │    • If cache misses, analyze POI density within 30km                      │
 * │    • Hub detected if 5+ gas stations/hotels nearby                         │
 * │    • Extract city name from POI addr:city tags                             │
 * │    • Cache the discovery for future trips                                  │
 * ├────────────────────────────────────────────────────────────────────────────┤
 * │  Tier 3: NOMINATIM FALLBACK (slow, 300-500ms)                              │
 * │    • Only reached for truly sparse areas                                   │
 * │    • Called by the consumer, not this module                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * SELF-LEARNING ALGORITHM:
 * 1. User plans a trip through new corridor (e.g., I-94 through Montana)
 * 2. Fuel stops trigger resolveHubName() calls
 * 3. Cache misses → POI analysis runs → discovers "Billings, MT" has 12 POIs
 * 4. Hub cached with 40km radius (medium city tier)
 * 5. Next trip through Billings: instant cache hit
 *
 * RADIUS SCALING (by POI count):
 *   • 20+ POIs → 60km radius (major metro: Chicago, Toronto)
 *   • 10+ POIs → 40km radius (medium city: Minneapolis, Calgary)
 *   • 5+ POIs  → 25km radius (small hub: Fargo, Brandon)
 *
 * HUB LIFECYCLE:
 *   seed (permanent) → discovered (90-day TTL) → promoted (permanent, earned)
 *   • Discovered hubs expire after 90 days of no use
 *   • Hubs used 3+ times auto-promote to permanent status
 *   • Seeds and promoted hubs only evicted by LRU (500-entry cap)
 *
 * CACHE MANAGEMENT:
 *   • In-memory singleton avoids repeated JSON.parse per lookup
 *   • LRU eviction keeps cache under 500 entries
 *   • Debounced async localStorage writes don't block UI
 *   • 20km deduplication prevents near-duplicate entries
 *
 * 💚 My Experience Engine
 */

import { haversineDistance } from './poi-ranking';
import type { POISuggestion } from '../types';
import { analyzeForHub } from './hub-poi-analysis';
export { analyzeForHub };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredHub {
  name: string;           // "Fargo, ND"
  lat: number;
  lng: number;
  radius: number;         // Coverage in km (scales with POI count)
  poiCount: number;       // Confidence indicator
  discoveredAt: string;   // ISO date
  lastUsed: string;       // ISO date (for LRU eviction)
  source: 'seed' | 'discovered' | 'promoted';
  useCount?: number;      // Times this hub resolved a lookup (optional for backcompat)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'roadtrip-discovered-hubs';
const MAX_CACHE_SIZE = 500;

// TTL and promotion
const EXPIRY_DAYS = 90;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const PROMOTION_THRESHOLD = 3;  // Uses before a discovered hub becomes promoted

// ─── Cache Management ─────────────────────────────────────────────────────────

// In-memory singleton — avoids repeated localStorage reads + JSON.parse per lookup.
// On a 2000km route with 10+ fuel checks, this saves ~100ms of main thread blocking.
let memoryCache: DiscoveredHub[] | null = null;
let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

function loadCache(): DiscoveredHub[] {
  // Return memory if already loaded (fast path)
  if (memoryCache) return memoryCache;

  // Otherwise, hit disk ONCE per session
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    memoryCache = cached ? (JSON.parse(cached) as DiscoveredHub[]) : [];
    return memoryCache;
  } catch {
    memoryCache = [];
    return memoryCache;
  }
}

function saveCache(hubs: DiscoveredHub[]): void {
  try {
    // Prune expired discovered hubs (90-day TTL)
    const now = Date.now();
    const alive = hubs.filter(h => {
      if (h.source === 'seed' || h.source === 'promoted') return true;
      const lastUsedTime = new Date(h.lastUsed).getTime();
      return (now - lastUsedTime) < EXPIRY_MS;
    });

    // LRU eviction: sort by lastUsed, keep most recent
    const sorted = [...alive].sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
    const trimmed = sorted.slice(0, MAX_CACHE_SIZE);

    // Update memory instantly (keeps lookups fast)
    memoryCache = trimmed;

    // Debounced async dump to disk — during route calculation findHubInWindow
    // fires 10+ times; this coalesces into a single localStorage write.
    if (pendingSaveTimer !== null) clearTimeout(pendingSaveTimer);
    pendingSaveTimer = setTimeout(() => {
      pendingSaveTimer = null;
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    }, 0);
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

/**
 * Record a "use" of a hub — updates lastUsed, increments useCount,
 * and auto-promotes discovered hubs that reach the threshold.
 */
function recordHubUse(hub: DiscoveredHub, hubs: DiscoveredHub[]): void {
  hub.lastUsed = new Date().toISOString();
  hub.useCount = (hub.useCount ?? 0) + 1;

  // Auto-promote discovered hubs that earn permanence
  if (hub.source === 'discovered' && hub.useCount >= PROMOTION_THRESHOLD) {
    hub.source = 'promoted';
  }

  saveCache(hubs);
}

/**
 * Find a known hub near the given coordinates.
 * Returns hub name if found, null otherwise.
 * Updates lastUsed timestamp on hit.
 *
 * **When to use:** Point-in-radius lookup. Use when you have exact coordinates
 * and want to check if they fall within any known hub's coverage area.
 * Example: Checking if an overnight stop location is in a city.
 *
 * @param lat - Target latitude
 * @param lng - Target longitude
 * @returns Hub name (e.g., "Fargo, ND") or null if not in any hub
 */
export function findKnownHub(lat: number, lng: number): string | null {
  const hubs = loadCache();

  for (const hub of hubs) {
    const dist = haversineDistance(lat, lng, hub.lat, hub.lng);
    if (dist <= hub.radius) {
      recordHubUse(hub, hubs);
      return hub.name;
    }
  }

  return null;
}

/**
 * Add a newly discovered hub to the cache.
 * Deduplicates by proximity (won't add if within 20km of existing hub).
 *
 * **When to use:** Internal. Called automatically by `resolveHubName` when
 * POI analysis discovers a new hub. Exported for testing.
 */
export function cacheDiscoveredHub(hub: Omit<DiscoveredHub, 'lastUsed' | 'useCount'>): void {
  const hubs = loadCache();

  // Check for duplicates by proximity
  const isDuplicate = hubs.some(
    h => haversineDistance(h.lat, h.lng, hub.lat, hub.lng) < 20
  );

  if (!isDuplicate) {
    hubs.push({
      ...hub,
      lastUsed: new Date().toISOString(),
      useCount: 0,
    });
    saveCache(hubs);
  }
}

/**
 * Seed the cache with initial hub data.
 * Only adds hubs that don't already exist (by proximity).
 *
 * **When to use:** App initialization. Called once on startup via
 * `initializeHubCache()` in hub-seed-data.ts. Pre-populates the cache
 * with 70+ major highway corridor cities.
 */
export function seedHubCache(seedHubs: Omit<DiscoveredHub, 'lastUsed'>[]): void {
  const hubs = loadCache();
  let added = 0;

  for (const seed of seedHubs) {
    const isDuplicate = hubs.some(
      h => haversineDistance(h.lat, h.lng, seed.lat, seed.lng) < 20
    );

    if (!isDuplicate) {
      hubs.push({
        ...seed,
        lastUsed: new Date().toISOString(),
      });
      added++;
    }
  }

  if (added > 0) {
    saveCache(hubs);
  }
}

// ─── Stop Placement Support ───────────────────────────────────────────────────

/**
 * Find the nearest known hub within a distance window of the current position.
 *
 * **When to use:** Stop placement. Use when you need to snap a stop location
 * to the nearest city. Unlike `findKnownHub` (point-in-radius), this searches
 * outward and returns the closest hub within the window.
 *
 * Example: Snapping fuel stops to "Fargo, ND" instead of "~515 km from Winnipeg".
 * Example: Snapping overnight splits to "Thunder Bay, ON" instead of "transit".
 *
 * @param currentLat - Current position latitude
 * @param currentLng - Current position longitude
 * @param windowKm - Search radius in km (default 80km)
 * @returns Nearest hub within window (full DiscoveredHub), or null if none found
 */
export function findHubInWindow(
  currentLat: number,
  currentLng: number,
  windowKm: number = 80,
): DiscoveredHub | null {
  const hubs = loadCache();

  let bestHub: DiscoveredHub | null = null;
  let bestDist = Infinity;

  for (const hub of hubs) {
    const distFromCurrent = haversineDistance(currentLat, currentLng, hub.lat, hub.lng);
    if (distFromCurrent <= windowKm && distFromCurrent < bestDist) {
      bestDist = distFromCurrent;
      bestHub = hub;
    }
  }

  // Record usage — keeps lastUsed fresh and drives promotion
  if (bestHub) {
    recordHubUse(bestHub, hubs);
  }

  return bestHub;
}

// ─── Debug / Admin ────────────────────────────────────────────────────────────

/**
 * Get cache statistics (for debugging).
 *
 * **When to use:** Debugging and analytics. Shows total hub count and
 * breakdown of seed vs discovered hubs.
 */
export function getHubCacheStats(): {
  totalHubs: number;
  seedHubs: number;
  discoveredHubs: number;
  promotedHubs: number;
} {
  const hubs = loadCache();
  return {
    totalHubs: hubs.length,
    seedHubs: hubs.filter(h => h.source === 'seed').length,
    discoveredHubs: hubs.filter(h => h.source === 'discovered').length,
    promotedHubs: hubs.filter(h => h.source === 'promoted').length,
  };
}

/**
 * Clear the hub cache (for testing/reset).
 * Resets both localStorage and in-memory singleton.
 *
 * **When to use:** Testing only. Resets the cache to empty state.
 * In production, prefer letting the LRU eviction manage cache size.
 */
export function clearHubCache(): void {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
}

// ─── Main Resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the hub name for a lat/lng position using a two-tier strategy:
 *   1. Check the hub cache (instant — covers seeded + previously discovered hubs)
 *   2. Analyze nearby POI density to discover a new hub and cache it
 *
 * **When to use:** Fuel stop and overnight stop labeling. Call this instead of
 * raw Nominatim when a quick city-name lookup is needed.
 *
 * @param lat - Target latitude
 * @param lng - Target longitude
 * @param pois - Available POI suggestions for density analysis
 * @returns Hub name (e.g., "Fargo, ND") or null if no hub found
 */
export function resolveHubName(
  lat: number,
  lng: number,
  pois: POISuggestion[],
): string | null {
  // Tier 1: Check known hub cache (instant)
  const known = findKnownHub(lat, lng);
  if (known) return known;

  // Tier 2: Analyze POI density (fast, CPU-only)
  const discovered = analyzeForHub(lat, lng, pois);
  if (discovered) {
    cacheDiscoveredHub(discovered);
    return discovered.name;
  }

  return null;
}

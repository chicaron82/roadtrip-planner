/**
 * hub-cache-storage.ts — Persistence layer for the Highway Hub Cache
 *
 * Owns: in-memory singleton, localStorage I/O, TTL/LRU eviction,
 * cross-tab invalidation, and the write operations (seed, cache, clear).
 *
 * Consumed exclusively by hub-cache.ts (the public lookup API).
 * Nothing outside this module pair needs to import from here directly.
 *
 * 💚 My Experience Engine
 */

import { haversineDistance } from './poi-ranking';

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

export const CACHE_KEY = 'roadtrip-discovered-hubs';
const MAX_CACHE_SIZE = 500;
const EXPIRY_DAYS = 90;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
export const PROMOTION_THRESHOLD = 3;  // Uses before a discovered hub becomes promoted

/**
 * Returns false for administrative placeholders that are geographically correct
 * but useless as trip stop labels — e.g. "Unorganized Kenora District".
 */
export function isUsableHubName(name: string): boolean {
  return !/unorganized/i.test(name);
}

// ─── In-memory singleton ─────────────────────────────────────────────────────

// Avoids repeated localStorage reads + JSON.parse per lookup.
// On a 2000km route with 10+ fuel checks, saves ~100ms of main thread blocking.
let memoryCache: DiscoveredHub[] | null = null;
let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function loadCache(): DiscoveredHub[] {
  if (memoryCache) return memoryCache;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    memoryCache = cached ? (JSON.parse(cached) as DiscoveredHub[]) : [];
    return memoryCache;
  } catch {
    memoryCache = [];
    return memoryCache;
  }
}

export function saveCache(hubs: DiscoveredHub[]): void {
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
export function recordHubUse(hub: DiscoveredHub, hubs: DiscoveredHub[]): void {
  hub.lastUsed = new Date().toISOString();
  hub.useCount = (hub.useCount ?? 0) + 1;

  if (hub.source === 'discovered' && hub.useCount >= PROMOTION_THRESHOLD) {
    hub.source = 'promoted';
  }

  saveCache(hubs);
}

// ─── Write operations ─────────────────────────────────────────────────────────

/**
 * Add a newly discovered hub to the cache.
 * Deduplicates by proximity (won't add if within 20km of existing hub).
 */
export function cacheDiscoveredHub(hub: Omit<DiscoveredHub, 'lastUsed' | 'useCount'>): void {
  if (!isUsableHubName(hub.name)) return;

  const hubs = loadCache();
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
 */
export function seedHubCache(seedHubs: Omit<DiscoveredHub, 'lastUsed'>[]): void {
  const hubs = loadCache();
  let added = 0;

  for (const seed of seedHubs) {
    const isDuplicate = hubs.some(
      h => haversineDistance(h.lat, h.lng, seed.lat, seed.lng) < 20
    );
    if (!isDuplicate) {
      hubs.push({ ...seed, lastUsed: new Date().toISOString() });
      added++;
    }
  }

  if (added > 0) saveCache(hubs);
}

/**
 * Clear the hub cache (for testing/reset).
 * Resets both localStorage and in-memory singleton.
 */
export function clearHubCache(): void {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
}

// ─── Cross-tab invalidation ───────────────────────────────────────────────────

// When another browser tab writes a new hub to localStorage, the in-memory
// singleton in this tab becomes stale. Clearing memoryCache forces the next
// lookup to re-read from localStorage so both tabs stay in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CACHE_KEY) {
      memoryCache = null;
    }
  });
}

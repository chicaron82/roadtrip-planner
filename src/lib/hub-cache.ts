/**
 * hub-cache.ts — Self-Learning Highway Hub Cache
 *
 * Discovers major hubs by analyzing POI density (gas stations, hotels).
 * Caches discoveries in localStorage for instant lookups on future trips.
 *
 * Flow:
 *   1. Check cache first (instant)
 *   2. If miss, analyze nearby POI density
 *   3. If hub detected, cache it + return name
 *   4. If sparse, return null (caller falls back to Nominatim)
 *
 * 💚 My Experience Engine
 */

import { haversineDistance } from './poi-ranking';
import type { POISuggestion } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredHub {
  name: string;           // "Fargo, ND"
  lat: number;
  lng: number;
  radius: number;         // Coverage in km (scales with POI count)
  poiCount: number;       // Confidence indicator
  discoveredAt: string;   // ISO date
  lastUsed: string;       // ISO date (for LRU eviction)
  source: 'seed' | 'discovered';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'roadtrip-discovered-hubs';
const MAX_CACHE_SIZE = 500;

// POI density thresholds for hub detection
const MIN_POIS_FOR_HUB = 5;
const SEARCH_RADIUS_KM = 30;

// Radius scaling based on POI count
const RADIUS_TIERS = [
  { minPois: 20, radius: 60 },  // Major metro (Chicago, Toronto)
  { minPois: 10, radius: 40 },  // Medium city (Minneapolis, Calgary)
  { minPois: 5, radius: 25 },   // Small hub (Fargo, Brandon)
];

// ─── Cache Management ─────────────────────────────────────────────────────────

// In-memory singleton — avoids repeated localStorage reads + JSON.parse per lookup.
// On a 2000km route with 10+ fuel checks, this saves ~100ms of main thread blocking.
let memoryCache: DiscoveredHub[] | null = null;

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
    // LRU eviction: sort by lastUsed, keep most recent
    const sorted = [...hubs].sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
    const trimmed = sorted.slice(0, MAX_CACHE_SIZE);

    // Update memory instantly (keeps lookups fast)
    memoryCache = trimmed;

    // Async dump to disk so UI doesn't freeze
    setTimeout(() => {
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    }, 0);
  } catch {
    // localStorage full or unavailable — silent fail
  }
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
      // Update lastUsed timestamp
      hub.lastUsed = new Date().toISOString();
      saveCache(hubs);
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
export function cacheDiscoveredHub(hub: Omit<DiscoveredHub, 'lastUsed'>): void {
  const hubs = loadCache();

  // Check for duplicates by proximity
  const isDuplicate = hubs.some(
    h => haversineDistance(h.lat, h.lng, hub.lat, hub.lng) < 20
  );

  if (!isDuplicate) {
    hubs.push({
      ...hub,
      lastUsed: new Date().toISOString(),
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

// ─── POI Analysis ─────────────────────────────────────────────────────────────

/**
 * Calculate appropriate radius based on POI density.
 */
function calculateHubRadius(poiCount: number): number {
  for (const tier of RADIUS_TIERS) {
    if (poiCount >= tier.minPois) {
      return tier.radius;
    }
  }
  return 25; // Default small hub
}

/**
 * Extract the most common city name from POI data.
 * Looks at addr:city in tags, then falls back to address parsing.
 */
function extractCityFromPOIs(pois: POISuggestion[]): string | null {
  const cityVotes: Record<string, number> = {};

  for (const poi of pois) {
    // Try addr:city from OSM tags first
    const addrCity = poi.tags?.['addr:city'];
    if (addrCity) {
      cityVotes[addrCity] = (cityVotes[addrCity] || 0) + 1;
      continue;
    }

    // Try addr:state for province/state code
    const addrState = poi.tags?.['addr:state'];

    // Fallback: parse from address string (often "123 Main St, Fargo, ND")
    if (poi.address) {
      const parts = poi.address.split(',').map(s => s.trim());
      // City is usually the second-to-last part
      if (parts.length >= 2) {
        const cityPart = parts[parts.length - 2];
        // Skip if it looks like a street address
        if (cityPart && !/^\d/.test(cityPart)) {
          const fullName = addrState ? `${cityPart}, ${addrState}` : cityPart;
          cityVotes[fullName] = (cityVotes[fullName] || 0) + 1;
        }
      }
    }
  }

  // Return the most common city name
  const entries = Object.entries(cityVotes);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Analyze POI density near a location to detect hubs.
 * Returns hub info if detected, null if area is sparse.
 *
 * **When to use:** Internal. Called by `resolveHubName` when cache misses.
 * Detects hubs by counting gas stations and hotels within 30km.
 * Exported for testing.
 *
 * @param lat - Target latitude
 * @param lng - Target longitude
 * @param pois - Available POI suggestions to analyze
 * @returns Discovered hub info, or null if area has <5 POIs
 */
export function analyzeForHub(
  lat: number,
  lng: number,
  pois: POISuggestion[]
): DiscoveredHub | null {
  // Filter to gas stations and hotels within search radius
  const nearbyPOIs = pois.filter(poi => {
    if (poi.category !== 'gas' && poi.category !== 'hotel') return false;
    const dist = haversineDistance(lat, lng, poi.lat, poi.lng);
    return dist <= SEARCH_RADIUS_KM;
  });

  // Not enough POIs for a hub
  if (nearbyPOIs.length < MIN_POIS_FOR_HUB) {
    return null;
  }

  // Extract city name from POI data
  const cityName = extractCityFromPOIs(nearbyPOIs);
  if (!cityName) {
    return null;
  }

  // Calculate centroid of the POI cluster
  const centroidLat = nearbyPOIs.reduce((sum, p) => sum + p.lat, 0) / nearbyPOIs.length;
  const centroidLng = nearbyPOIs.reduce((sum, p) => sum + p.lng, 0) / nearbyPOIs.length;

  return {
    name: cityName,
    lat: centroidLat,
    lng: centroidLng,
    radius: calculateHubRadius(nearbyPOIs.length),
    poiCount: nearbyPOIs.length,
    discoveredAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    source: 'discovered',
  };
}

/**
 * Main resolution function: cache-first, then POI analysis.
 * Returns hub name if found/discovered, null for Nominatim fallback.
 *
 * **When to use:** Primary entry point for town name resolution.
 * Use this when you have a location and want the best available name.
 * Handles the full tiered resolution: cache → POI analysis → (caller falls back to Nominatim).
 *
 * Example: Labeling fuel stops in the Smart Timeline.
 *
 * @param lat - Target latitude
 * @param lng - Target longitude
 * @param pois - Available POI suggestions (optional, enables discovery)
 * @returns Hub name (e.g., "Fargo, ND") or null (caller should try Nominatim)
 */
export function resolveHubName(
  lat: number,
  lng: number,
  pois?: POISuggestion[]
): string | null {
  // 1. Check cache first (instant)
  const cached = findKnownHub(lat, lng);
  if (cached) {
    return cached;
  }

  // 2. If POI data available, analyze for hub
  if (pois && pois.length > 0) {
    const discovered = analyzeForHub(lat, lng, pois);
    if (discovered) {
      // Cache the discovery for future trips
      cacheDiscoveredHub(discovered);
      return discovered.name;
    }
  }

  // 3. No hub found — caller should fall back to Nominatim
  return null;
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
} {
  const hubs = loadCache();
  return {
    totalHubs: hubs.length,
    seedHubs: hubs.filter(h => h.source === 'seed').length,
    discoveredHubs: hubs.filter(h => h.source === 'discovered').length,
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

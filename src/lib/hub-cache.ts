/**
 * hub-cache.ts — Self-Learning Highway Hub Cache (Public Lookup API)
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
 * Storage + eviction logic lives in hub-cache-storage.ts.
 * This module owns the lookup and scoring API.
 *
 * 💚 My Experience Engine
 */

import { haversineDistance } from './geo-utils';
import type { POISuggestion } from '../types';
import { analyzeForHub } from './hub-poi-analysis';
import {
  type DiscoveredHub,
  isUsableHubName,
  loadCache,
  recordHubUse,
  cacheDiscoveredHub,
  seedHubCache,
  clearHubCache,
} from './hub-cache-storage';

export type { DiscoveredHub };
export { analyzeForHub, cacheDiscoveredHub, seedHubCache, clearHubCache };

// ─── Point-in-radius lookup ───────────────────────────────────────────────────

/**
 * Find a known hub near the given coordinates.
 * Returns hub name if found, null otherwise.
 * Updates lastUsed timestamp on hit.
 *
 * **When to use:** Point-in-radius lookup. Use when you have exact coordinates
 * and want to check if they fall within any known hub's coverage area.
 * Example: Checking if an overnight stop location is in a city.
 */
export function findKnownHub(lat: number, lng: number): string | null {
  const hubs = loadCache();

  for (const hub of hubs) {
    if (!isUsableHubName(hub.name)) continue;
    const dist = haversineDistance(lat, lng, hub.lat, hub.lng);
    if (dist <= hub.radius) {
      recordHubUse(hub, hubs);
      return hub.name;
    }
  }

  return null;
}

// ─── Window-based nearest lookup ─────────────────────────────────────────────

/**
 * Find the nearest known hub within a distance window of the current position.
 *
 * **When to use:** Stop placement. Use when you need to snap a stop location
 * to the nearest city. Unlike `findKnownHub` (point-in-radius), this searches
 * outward and returns the closest hub within the window.
 *
 * Example: Snapping fuel stops to "Fargo, ND" instead of "~515 km from Winnipeg".
 * Example: Snapping overnight splits to "Thunder Bay, ON" instead of "transit".
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
    if (!isUsableHubName(hub.name)) continue;
    const distFromCurrent = haversineDistance(currentLat, currentLng, hub.lat, hub.lng);
    if (distFromCurrent <= windowKm && distFromCurrent < bestDist) {
      bestDist = distFromCurrent;
      bestHub = hub;
    }
  }

  if (bestHub) recordHubUse(bestHub, hubs);
  return bestHub;
}

// ─── Scored lookup (Option-B prewarm suppression) ────────────────────────────

function scorePracticalHubCandidate(hub: DiscoveredHub, distanceKm: number): number {
  const sourceBonus = hub.source === 'seed'
    ? 18
    : hub.source === 'promoted'
      ? 12
      : Math.min(6, (hub.useCount ?? 0) * 2);
  const serviceScore = hub.poiCount * 2.5 + hub.radius * 0.35;
  const distancePenalty = distanceKm * 1.2;
  return serviceScore + sourceBonus - distancePenalty;
}

/**
 * Seed/promoted hubs are always searched within this radius regardless of
 * the caller's windowKm. This ensures a major seeded city like El Paso is
 * never excluded by a narrow per-segment window when a tiny prewarm-injected
 * waypoint (e.g. "Praxedis G. Guerrero") happens to be closer.
 */
const SEED_FALLBACK_WINDOW_KM = 100;

/**
 * Find the most practical hub within a window, balancing proximity against
 * likely services. This favors major corridor cities over tiny nearby border
 * settlements when the user-facing label should reflect the place they'd
 * realistically stop.
 *
 * Option-B suppression: a freshly prewarm-injected hub (poiCount ≤ 5,
 * useCount === 0, source = 'discovered') is excluded from competition
 * whenever a seed or promoted hub exists within SEED_FALLBACK_WINDOW_KM.
 * This prevents a route waypoint that geocoded to a small municipality from
 * beating a well-known city just because it is a few km closer.
 */
export function findPreferredHubInWindow(
  currentLat: number,
  currentLng: number,
  windowKm: number = 80,
): DiscoveredHub | null {
  const hubs = loadCache();

  const hasSeedHubNearby = hubs.some(
    hub =>
      (hub.source === 'seed' || hub.source === 'promoted') &&
      isUsableHubName(hub.name) &&
      haversineDistance(currentLat, currentLng, hub.lat, hub.lng) <= SEED_FALLBACK_WINDOW_KM,
  );

  let bestHub: DiscoveredHub | null = null;
  let bestScore = -Infinity;
  let bestDist = Infinity;

  for (const hub of hubs) {
    if (!isUsableHubName(hub.name)) continue;

    const distanceKm = haversineDistance(currentLat, currentLng, hub.lat, hub.lng);

    const effectiveWindow =
      hub.source === 'seed' || hub.source === 'promoted'
        ? Math.max(windowKm, SEED_FALLBACK_WINDOW_KM)
        : windowKm;
    if (distanceKm > effectiveWindow) continue;

    const isMinTierDiscovered =
      hub.source === 'discovered' &&
      hub.poiCount <= 5 &&
      (hub.useCount ?? 0) === 0;
    if (isMinTierDiscovered && hasSeedHubNearby) continue;

    const score = scorePracticalHubCandidate(hub, distanceKm);
    if (score > bestScore || (score === bestScore && distanceKm < bestDist)) {
      bestHub = hub;
      bestScore = score;
      bestDist = distanceKm;
    }
  }

  if (bestHub) recordHubUse(bestHub, hubs);
  return bestHub;
}

// ─── Debug / Admin ────────────────────────────────────────────────────────────

/**
 * Get cache statistics (for debugging).
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

// ─── Main Resolver ────────────────────────────────────────────────────────────

/**
 * Resolve the hub name for a lat/lng position using a two-tier strategy:
 *   1. Check the hub cache (instant — covers seeded + previously discovered hubs)
 *   2. Analyze nearby POI density to discover a new hub and cache it
 *
 * **When to use:** Fuel stop and overnight stop labeling. Call this instead of
 * raw Nominatim when a quick city-name lookup is needed.
 */
export function resolveHubName(
  lat: number,
  lng: number,
  pois: POISuggestion[] = [],
): string | null {
  const known = findKnownHub(lat, lng);
  if (known) return known;

  const discovered = analyzeForHub(lat, lng, pois);
  if (discovered) {
    cacheDiscoveredHub(discovered);
    return discovered.name;
  }

  return null;
}

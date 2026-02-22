import type { Location, TripPreference, POISuggestionGroup } from '../../types';

// ==================== SESSION CACHE ====================
// Prevents hammering Overpass with repeat queries for the same route.
// Keyed on a lightweight hash of the route geometry + preferences.

const POI_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const POI_CACHE_MAX_ENTRIES = 10;

interface POICacheEntry {
  result: POISuggestionGroup;
  expiresAt: number;
}

export const POI_SESSION_CACHE = new Map<string, POICacheEntry>();

/**
 * In-flight deduplication — if two fetchPOISuggestions calls arrive for the
 * same cache key before the first resolves, share the same promise instead
 * of firing a second set of Overpass queries.
 */
export const POI_IN_FLIGHT = new Map<string, Promise<POISuggestionGroup>>();

/**
 * Lightweight route geometry hash: round coords to 2dp (~1km precision),
 * sample every Nth point for long routes, join with preferences.
 */
export function hashRouteKey(
  geometry: [number, number][],
  destination: Location,
  preferences: TripPreference[]
): string {
  // Sample at most 20 points evenly
  const step = Math.max(1, Math.floor(geometry.length / 20));
  const sampled = geometry.filter((_, i) => i % step === 0);
  const coordStr = sampled.map(([lat, lng]) => `${lat.toFixed(2)},${lng.toFixed(2)}`).join('|');
  const destStr = `${destination.lat?.toFixed(2)},${destination.lng?.toFixed(2)}`;
  const prefStr = [...preferences].sort().join(',');
  return `${coordStr}::${destStr}::${prefStr}`;
}

export function getCachedPOIs(key: string): POISuggestionGroup | null {
  const entry = POI_SESSION_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    POI_SESSION_CACHE.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedPOIs(key: string, result: POISuggestionGroup): void {
  // Evict oldest entry if at capacity
  if (POI_SESSION_CACHE.size >= POI_CACHE_MAX_ENTRIES) {
    const oldest = POI_SESSION_CACHE.keys().next().value;
    if (oldest) POI_SESSION_CACHE.delete(oldest);
  }
  POI_SESSION_CACHE.set(key, { result, expiresAt: Date.now() + POI_CACHE_TTL_MS });
}

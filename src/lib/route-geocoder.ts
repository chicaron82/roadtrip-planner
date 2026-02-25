/**
 * route-geocoder.ts — Resolve town names from route geometry
 *
 * Given a route polyline and a km mark, interpolate the lat/lng position
 * then resolve to a human-readable town name.
 *
 * Resolution priority:
 *   1. Hub cache (instant) — known major hubs from previous trips
 *   2. POI analysis (fast) — detect hubs by gas station/hotel density
 *   3. Nominatim (slow) — reverse geocode for small towns
 *
 * Used by SmartTimeline to replace "~250 km from Winnipeg" with "near Fargo, ND".
 *
 * 💚 My Experience Engine
 */

import { haversineDistance } from './poi-ranking';
import type { TimedEvent } from './trip-timeline';
import type { POISuggestion } from '../types';
import { resolveHubName } from './hub-cache';
import { NOMINATIM_BASE_URL } from './constants';

// ─── Rate limiting ────────────────────────────────────────────────────────────

/** Nominatim usage policy: max 1 request per second */
const NOMINATIM_DELAY_MS = 1100;

/** In-memory cache: rounded km → town name (avoids repeat fetches) */
const townCache = new Map<number, string | null>();

/** Round km to nearest 5 for cache key (stops 2 km apart hit same cache) */
const cacheKey = (km: number): number => Math.round(km / 5) * 5;

// ─── Geometry interpolation ──────────────────────────────────────────────────

/**
 * Walk along the route polyline and return the lat/lng at a given km mark.
 *
 * Uses the same haversine-based interpolation pattern as calculations.ts.
 * Geometry format: [lat, lng][] (matching fullGeometry from OSRM).
 */
export function interpolateRoutePosition(
  geometry: number[][],
  targetKm: number,
): { lat: number; lng: number } | null {
  if (geometry.length < 2 || targetKm <= 0) return null;

  let accumulated = 0;

  for (let i = 0; i < geometry.length - 1; i++) {
    const [lat1, lng1] = geometry[i];
    const [lat2, lng2] = geometry[i + 1];
    const segLen = haversineDistance(lat1, lng1, lat2, lng2);

    if (accumulated + segLen >= targetKm) {
      // Target falls within this segment — interpolate
      const progress = segLen > 0 ? (targetKm - accumulated) / segLen : 0;
      return {
        lat: lat1 + (lat2 - lat1) * progress,
        lng: lng1 + (lng2 - lng1) * progress,
      };
    }

    accumulated += segLen;
  }

  // Target km exceeds the total route length — return null.
  // Do NOT fall through to the last point; callers must handle null to
  // avoid resolving out-of-bounds positions to the route's endpoint.
  return null;
}

// ─── Reverse geocoding ───────────────────────────────────────────────────────

/**
 * Reverse geocode a lat/lng to a "Town, Province" string via Nominatim.
 *
 * Uses zoom=10 for city-level resolution (not street-level).
 * Returns a formatted string like "Dryden, ON" or "Fargo, ND", or null on failure.
 * The province/state code is appended so users can place unfamiliar stop names.
 */
export async function reverseGeocodeTown(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const url =
      `${NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}` +
      `&format=json&zoom=10&addressdetails=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'RoadTripPlanner/1.0' },
      signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const addr = data.address;
    if (!addr) return null;

    // Priority: city → town → village → hamlet
    // Skip municipality if it's an "Unorganized" rural district (common in Ontario/Canada)
    const directName =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.hamlet;

    let townName: string | null = null;

    if (directName) {
      townName = directName;
    } else {
      // Fallback: county/district — strip "Unorganized " prefix and " District"/" County"
      // suffix so "Unorganized Kenora District" → "Kenora"
      const rawCounty: string | undefined = addr.county ?? addr.municipality ?? addr.state_district;
      if (rawCounty) {
        townName = rawCounty
          .replace(/^Unorganized\s+/i, '')
          .replace(/\s+District$/i, '')
          .replace(/\s+County$/i, '')
          .trim() || null;
      }
    }

    if (!townName) return null;

    // Append province/state code so users can place unfamiliar stop names.
    // Nominatim provides ISO 3166-2 codes (e.g. "ON", "MB", "ND", "MN").
    const stateCode: string | undefined = addr.ISO3166_2_lvl4
      ? (addr.ISO3166_2_lvl4 as string).replace(/^[A-Z]+-/, '') // "CA-ON" → "ON"
      : addr.state_code;

    if (stateCode) return `${townName}, ${stateCode}`;
    return townName;
  } catch {
    // Network error, abort, etc — graceful fallback
    return null;
  }
}

// ─── Batch resolution ─────────────────────────────────────────────────────────

/** Sleep helper for rate limiting */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * For each stop event with a generic "~X km" locationHint, resolve the
 * nearest town name using a tiered approach:
 *
 *   1. Hub cache (instant) — check for known major hubs
 *   2. POI analysis (fast) — detect hubs by gas/hotel density
 *   3. Nominatim (slow) — reverse geocode for small towns
 *
 * Returns a Map<eventId, townName> of successfully resolved towns.
 *
 * @param events - Timeline events to resolve
 * @param geometry - Route polyline for position interpolation
 * @param signal - AbortSignal for cleanup on unmount
 * @param pois - Optional POI data for hub discovery
 */
export async function resolveStopTowns(
  events: TimedEvent[],
  geometry: number[][],
  signal?: AbortSignal,
  pois?: POISuggestion[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (geometry.length < 2) return result;

  // Filter to only events that need enrichment
  const needsEnrichment = events.filter(
    e =>
      e.type !== 'departure' &&
      e.type !== 'arrival' &&
      e.type !== 'drive' &&
      e.locationHint.startsWith('~'),
  );

  if (needsEnrichment.length === 0) return result;

  let isFirst = true;

  for (const event of needsEnrichment) {
    if (signal?.aborted) break;

    const key = cacheKey(event.distanceFromOriginKm);

    // Check in-memory cache first
    if (townCache.has(key)) {
      const cached = townCache.get(key);
      if (cached) result.set(event.id, cached);
      continue;
    }

    // Interpolate position on route
    const pos = interpolateRoutePosition(geometry, event.distanceFromOriginKm);
    if (!pos) continue;

    // Tier 1 & 2: Hub cache + POI analysis (instant/fast)
    const hubName = resolveHubName(pos.lat, pos.lng, pois);
    if (hubName) {
      townCache.set(key, hubName);
      result.set(event.id, hubName);
      continue;
    }

    // Tier 3: Nominatim reverse geocode (slow, rate-limited)
    // Rate limit (skip delay on first request)
    if (!isFirst) await sleep(NOMINATIM_DELAY_MS);
    isFirst = false;

    const town = await reverseGeocodeTown(pos.lat, pos.lng, signal);

    // Cache result (even nulls, to avoid re-fetching)
    townCache.set(key, town);

    if (town) {
      result.set(event.id, town);
    }
  }

  return result;
}

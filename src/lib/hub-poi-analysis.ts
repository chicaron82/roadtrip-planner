/**
 * hub-poi-analysis.ts — POI-based hub discovery for the Self-Learning Hub Cache
 *
 * Analyzes nearby POI density to detect whether a location is a highway hub
 * (i.e., a city/town worth caching for future fuel stop labeling).
 */

import { haversineDistance } from './poi-ranking';
import type { POISuggestion } from '../types';
import type { DiscoveredHub } from './hub-cache';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum gas stations + hotels within search radius to classify as a hub. */
const MIN_POIS_FOR_HUB = 5;

/** How far to search for POIs when detecting a hub (km). */
const SEARCH_RADIUS_KM = 30;

/** Radius scaling based on POI count. */
const RADIUS_TIERS = [
  { minPois: 20, radius: 60 },  // Major metro (Chicago, Toronto)
  { minPois: 10, radius: 40 },  // Medium city (Minneapolis, Calgary)
  { minPois: 5,  radius: 25 },  // Small hub (Fargo, Brandon)
];

// ─── Internals ────────────────────────────────────────────────────────────────

/** Calculate appropriate hub radius based on POI density. */
function calculateHubRadius(poiCount: number): number {
  for (const tier of RADIUS_TIERS) {
    if (poiCount >= tier.minPois) return tier.radius;
  }
  return 25;
}

/** Extract the most common city name from POI data. */
function extractCityFromPOIs(pois: POISuggestion[]): string | null {
  const cityVotes: Record<string, number> = {};

  for (const poi of pois) {
    const addrCity = poi.tags?.['addr:city'];
    if (addrCity) {
      cityVotes[addrCity] = (cityVotes[addrCity] || 0) + 1;
      continue;
    }

    const addrState = poi.tags?.['addr:state'];

    if (poi.address) {
      const parts = poi.address.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        const cityPart = parts[parts.length - 2];
        if (cityPart && !/^\d/.test(cityPart)) {
          const fullName = addrState ? `${cityPart}, ${addrState}` : cityPart;
          cityVotes[fullName] = (cityVotes[fullName] || 0) + 1;
        }
      }
    }
  }

  const entries = Object.entries(cityVotes);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// ─── Exported ────────────────────────────────────────────────────────────────

/**
 * Analyze POI density near a location to detect hubs.
 * Returns hub info if detected (≥5 gas/hotel POIs within 30km), null otherwise.
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
  const nearbyPOIs = pois.filter(poi => {
    if (poi.category !== 'gas' && poi.category !== 'hotel') return false;
    const dist = haversineDistance(lat, lng, poi.lat, poi.lng);
    return dist <= SEARCH_RADIUS_KM;
  });

  if (nearbyPOIs.length < MIN_POIS_FOR_HUB) return null;

  const cityName = extractCityFromPOIs(nearbyPOIs);
  if (!cityName) return null;

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
    useCount: 0,
  };
}

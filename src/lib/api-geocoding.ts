/**
 * api-geocoding.ts — Location search providers (Nominatim + Photon).
 *
 * Exports individual provider functions for the provider seam:
 *   - searchWithNominatim — accurate, exact city/place names
 *
 * Legacy: searchLocations (Nominatim-only) is still exported
 * for any direct consumers. The provider dispatcher in
 * providers/geocoding-provider.ts is the canonical entry point.
 */
import type { Location } from '../types';
import type { GeocodingResult } from './providers/provider-types';
import { PROVIDER_URLS } from './providers/provider-config';
import { sanitizeLocationName } from './location-sanitizer';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// ── Individual provider exports (for the provider seam) ───────────────────

export async function searchWithNominatim(query: string): Promise<GeocodingResult[]> {
  const response = await fetch(
    `${PROVIDER_URLS.nominatim}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
  );
  if (!response.ok) return [];
  const data: NominatimResult[] = await response.json();
  return data.map(item => ({
    id: crypto.randomUUID(),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    name: sanitizeLocationName(item.display_name),
    address: item.display_name,
  }));
}

// ── Legacy composite export ───────────────────────────────────────────────
// Preserved for any direct consumers. New code should use the provider
// dispatcher (providers/geocoding-provider.ts) via the api.ts barrel.

export async function searchLocations(query: string): Promise<Partial<Location>[]> {
  try {
    return await searchWithNominatim(query);
  } catch {
    return [];
  }
}

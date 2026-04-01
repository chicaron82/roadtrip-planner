/**
 * api-geocoding.ts — Location search providers (Nominatim + Photon).
 *
 * Exports individual provider functions for the provider seam:
 *   - searchWithNominatim — accurate, exact city/place names
 *   - searchWithPhoton    — fuzzy/typo-tolerant fallback
 *
 * Photon's index is missing major Canadian cities (Toronto, Winnipeg, Ottawa)
 * as of March 2026, so Nominatim must be the primary source.
 *
 * Legacy: searchLocations (Nominatim → Photon chain) is still exported
 * for any direct consumers. The provider dispatcher in
 * providers/geocoding-provider.ts is the canonical entry point.
 */
import type { Location } from '../types';
import type { GeocodingResult } from './providers/provider-types';
import { PROVIDER_URLS } from './providers/provider-config';
import { sanitizeLocationName } from './location-sanitizer';

interface PhotonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    locality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    type?: string;
    osm_type?: string;
  };
}

interface PhotonResponse {
  type: 'FeatureCollection';
  features: PhotonFeature[];
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/** Build a readable short name from Photon feature properties. */
function photonDisplayName(p: PhotonFeature['properties']): { name: string; address: string } {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  if (p.city && p.city !== p.name) parts.push(p.city);
  else if (p.locality && p.locality !== p.name) parts.push(p.locality);
  if (p.state) parts.push(p.state);
  if (p.country) parts.push(p.country);

  const name = parts.slice(0, 2).join(', ');
  const address = parts.join(', ');
  return { name, address };
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

export async function searchWithPhoton(query: string): Promise<GeocodingResult[]> {
  const photonUrl = `${PROVIDER_URLS.photon}/api/?q=${encodeURIComponent(query)}&limit=7&lang=en&lat=50&lon=-95`;
  const res = await fetch(photonUrl);
  if (!res.ok) return [];
  const data: PhotonResponse = await res.json();
  const results = data.features
    .filter(f => f.geometry?.coordinates?.length === 2 && (f.properties.name || f.properties.city))
    .map(f => {
      const [lng, lat] = f.geometry.coordinates;
      const { name, address } = photonDisplayName(f.properties);
      return { id: crypto.randomUUID(), lat, lng, name, address };
    });

  // Deduplicate by name (Photon sometimes returns dupes at different zoom levels)
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

// ── Legacy composite export ───────────────────────────────────────────────
// Preserved for any direct consumers. New code should use the provider
// dispatcher (providers/geocoding-provider.ts) via the api.ts barrel.

export async function searchLocations(query: string): Promise<Partial<Location>[]> {
  try {
    const results = await searchWithNominatim(query);
    if (results.length > 0) return results;
  } catch {
    // fall through to Photon
  }

  try {
    return await searchWithPhoton(query);
  } catch (error) {
    console.warn('[geocoding] Photon fallback failed:', error);
  }

  return [];
}

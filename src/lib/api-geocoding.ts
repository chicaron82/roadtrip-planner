/**
 * api-geocoding.ts — Location search (Nominatim primary, Photon fallback).
 *
 * Primary: Nominatim — accurate results for exact city/place names.
 * Fallback: Photon (komoot) — fuzzy/typo-tolerant, used when Nominatim
 *           returns nothing (partial queries, misspellings).
 *
 * Photon's index is missing major Canadian cities (Toronto, Winnipeg, Ottawa)
 * as of March 2026, so Nominatim must be the primary source.
 */
import type { Location } from '../types';
import { NOMINATIM_BASE_URL } from './constants';
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

export async function searchLocations(query: string): Promise<Partial<Location>[]> {
  // ── Nominatim (accurate) ────────────────────────────────────────────────
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    );
    if (response.ok) {
      const data: NominatimResult[] = await response.json();
      if (data.length > 0) {
        return data.map(item => ({
          id: crypto.randomUUID(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          name: sanitizeLocationName(item.display_name),
          address: item.display_name,
        }));
      }
    }
  } catch {
    // fall through to Photon
  }

  // ── Photon fallback (fuzzy) ─────────────────────────────────────────────
  // Catches partial queries and misspellings that Nominatim can't match.
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=7&lang=en&lat=50&lon=-95`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data: PhotonResponse = await res.json();
      const results = data.features
        .filter(f => f.geometry?.coordinates?.length === 2 && (f.properties.name || f.properties.city))
        .map(f => {
          const [lng, lat] = f.geometry.coordinates;
          const { name, address } = photonDisplayName(f.properties);
          return {
            id: crypto.randomUUID(),
            lat,
            lng,
            name,
            address,
          } satisfies Partial<Location>;
        });

      // Deduplicate by name (Photon sometimes returns dupes at different zoom levels)
      const seen = new Set<string>();
      const deduped = results.filter(r => {
        const key = r.name?.toLowerCase() ?? '';
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (deduped.length > 0) return deduped.slice(0, 6);
    }
  } catch (error) {
    console.error('Search failed:', error);
  }

  return [];
}

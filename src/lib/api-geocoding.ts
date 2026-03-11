/**
 * api-geocoding.ts — Location search (Photon primary, Nominatim fallback).
 *
 * Primary: Photon (komoot) — fuzzy/typo-tolerant, built on Nominatim data, no key needed.
 * Fallback: Nominatim — exact match only, used if Photon returns nothing.
 */
import type { Location } from '../types';
import { NOMINATIM_BASE_URL } from './constants';

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
  // ── Photon (fuzzy) ──────────────────────────────────────────────────────
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=7&lang=en`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data: PhotonResponse = await res.json();
      const results = data.features
        // Keep only point-like results that have usable coords + a name
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

      // Deduplicate by name+country (Photon sometimes returns dupes at different zoom levels)
      const seen = new Set<string>();
      const deduped = results.filter(r => {
        const key = r.name?.toLowerCase() ?? '';
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (deduped.length > 0) return deduped.slice(0, 6);
    }
  } catch {
    // fall through to Nominatim
  }

  // ── Nominatim fallback (exact) ──────────────────────────────────────────
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    );
    if (!response.ok) return [];
    const data: NominatimResult[] = await response.json();
    return data.map(item => ({
      id: crypto.randomUUID(),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: item.display_name.split(',').slice(0, 2).join(',').trim(),
      address: item.display_name,
    }));
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

/**
 * google-geocoding.ts — Google Places API (New) adapter.
 *
 * Uses the searchText endpoint (single-call with coordinates).
 * No Autocomplete → Geocode two-step tax.
 *
 * Auth: X-Goog-Api-Key header (CORS-friendly, no SDK needed).
 *
 * 💚 My Experience Engine — Google geocoding adapter
 */

import type { GeocodingResult } from '../provider-types';
import { GOOGLE_MAPS_KEY, PROVIDER_URLS, PROVIDER_CONFIG } from '../provider-config';

/** Bounding bias: North America (Canada + USA). */
const LOCATION_BIAS = {
  rectangle: {
    low: { latitude: 24.0, longitude: -140.0 },
    high: { latitude: 83.0, longitude: -52.0 },
  },
};

/** Fields we need — minimise billing by requesting only what's used. */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
].join(',');

interface PlacesResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string; languageCode?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }>;
}

export async function searchWithGoogle(query: string): Promise<GeocodingResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CONFIG.google.timeoutMs);

  try {
    const response = await fetch(PROVIDER_URLS.googlePlaces, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: LOCATION_BIAS,
        maxResultCount: 5,
        languageCode: 'en',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Places API ${response.status}: ${response.statusText}`);
    }

    const data: PlacesResponse = await response.json();
    if (!data.places?.length) return [];

    return data.places
      .filter(p => p.location?.latitude != null && p.location?.longitude != null)
      .map(p => ({
        id: p.id,
        name: p.displayName?.text ?? p.formattedAddress ?? query,
        address: p.formattedAddress ?? '',
        lat: p.location!.latitude,
        lng: p.location!.longitude,
      }));
  } finally {
    clearTimeout(timeoutId);
  }
}

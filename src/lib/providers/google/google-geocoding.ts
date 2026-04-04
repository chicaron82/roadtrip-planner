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
import { makeProviderHttpError } from '../provider-types';
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
    addressComponents?: Array<{
      longText: string;
      shortText: string;
      types: string[];
    }>;
  }>;
}

/** Fields for nearby town lookup — includes addressComponents for province extraction. */
const NEARBY_FIELD_MASK = [
  'places.displayName',
  'places.location',
  'places.addressComponents',
].join(',');

/**
 * Reverse geocode a coordinate to the nearest locality using Places API (New).
 *
 * Uses nearbySearch with includedTypes: ['locality'] rather than the legacy
 * Geocoding API, which cannot be used with HTTP referrer-restricted keys.
 *
 * Returns "Town, Province" (e.g. "Thunder Bay, ON") or null if not found.
 */
export async function findNearbyTownWithGoogle(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ name: string; lat: number; lng: number } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CONFIG.google.timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': NEARBY_FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 50000,
          },
        },
        includedTypes: ['locality'],
        maxResultCount: 1,
        languageCode: 'en',
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data: PlacesResponse = await response.json();
    const place = data.places?.[0];
    if (!place?.displayName?.text || !place.location) return null;

    const components = place.addressComponents ?? [];
    const adminLevel1 = components.find(c => c.types.includes('administrative_area_level_1'));
    const name = adminLevel1?.shortText
      ? `${place.displayName.text}, ${adminLevel1.shortText}`
      : place.displayName.text;

    return { name, lat: place.location.latitude, lng: place.location.longitude };
  } finally {
    clearTimeout(timeoutId);
  }
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
      throw makeProviderHttpError(`Places API ${response.status}: ${response.statusText}`, response.status);
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

/**
 * google-places-nearby.ts — Google Places Nearby Search (New) adapter.
 *
 * Low-level wrapper for the searchNearby endpoint.
 * Used by fuel-stop-snapper and POI corridor search.
 *
 * POST https://places.googleapis.com/v1/places:searchNearby
 * Auth: X-Goog-Api-Key header (CORS-friendly).
 *
 * 💚 My Experience Engine — Google POI adapter
 */

import { makeProviderHttpError } from '../provider-types';
import { GOOGLE_MAPS_KEY, PROVIDER_URLS, PROVIDER_CONFIG } from '../provider-config';

/** Google Places type → app-friendly type mapping. */
export const GOOGLE_POI_TYPES: Record<string, string[]> = {
  gas:           ['gas_station'],
  restaurant:    ['restaurant'],
  cafe:          ['cafe'],
  hotel:         ['lodging'],
  attraction:    ['tourist_attraction'],
  museum:        ['museum'],
  park:          ['park', 'national_park'],
  landmark:      ['tourist_attraction'],    // Google doesn't have a separate landmark type
  viewpoint:     ['tourist_attraction'],    // No direct equivalent
  charge:        ['electric_vehicle_charging_station'],
  shopping:      ['shopping_mall', 'supermarket'],
  entertainment: ['amusement_park', 'bowling_alley'],
};

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
].join(',');

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
}

interface NearbyResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
  }>;
}

/**
 * Search for places near a point. Returns up to maxResultCount places
 * of the given Google types within radiusM metres.
 */
export async function searchNearby(
  lat: number,
  lng: number,
  radiusM: number,
  includedTypes: string[],
  maxResultCount = 20,
): Promise<NearbyPlace[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CONFIG.google.timeoutMs);

  try {
    const response = await fetch(PROVIDER_URLS.googleNearby, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusM,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw makeProviderHttpError(`Nearby Search ${response.status}: ${response.statusText}`, response.status);
    }

    const data: NearbyResponse = await response.json();
    if (!data.places?.length) return [];

    return data.places
      .filter(p => p.location?.latitude != null && p.location?.longitude != null)
      .map(p => ({
        id: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        lat: p.location!.latitude,
        lng: p.location!.longitude,
        type: p.primaryType,
      }));
  } finally {
    clearTimeout(timeoutId);
  }
}

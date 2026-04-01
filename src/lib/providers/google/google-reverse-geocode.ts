/**
 * google-reverse-geocode.ts — Google Geocoding API reverse lookup.
 *
 * Given a lat/lng, returns the nearest locality (city/town/village).
 * Used by overnight-snapper to find town names for transit-split points.
 *
 * GET https://maps.googleapis.com/maps/api/geocode/json
 * Auth: key query param (Geocoding API, not Places API New).
 *
 * 💚 My Experience Engine — Google reverse geocode adapter
 */

import { GOOGLE_MAPS_KEY, PROVIDER_CONFIG } from '../provider-config';

export interface ReverseGeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

interface GeocodeResponse {
  results?: Array<{
    address_components?: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry?: {
      location?: { lat: number; lng: number };
    };
  }>;
  status?: string;
}

/**
 * Reverse geocode a coordinate to find the nearest locality.
 * Returns the city/town name with province/state code if available.
 */
export async function reverseGeocodeWithGoogle(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CONFIG.google.timeoutMs);

  // Chain abort signals
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('result_type', 'locality|administrative_area_level_3');
    url.searchParams.set('key', GOOGLE_MAPS_KEY);

    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;

    const data: GeocodeResponse = await response.json();
    if (data.status !== 'OK' || !data.results?.length) return null;

    const result = data.results[0];
    const components = result.address_components ?? [];

    // Extract locality name
    const locality = components.find(c => c.types.includes('locality'));
    const sublocality = components.find(c => c.types.includes('administrative_area_level_3'));
    const townName = locality?.long_name ?? sublocality?.long_name;
    if (!townName) return null;

    // Extract province/state code for display
    const adminLevel1 = components.find(c => c.types.includes('administrative_area_level_1'));
    const name = adminLevel1?.short_name
      ? `${townName}, ${adminLevel1.short_name}`
      : townName;

    const loc = result.geometry?.location;

    return {
      name,
      lat: loc?.lat ?? lat,
      lng: loc?.lng ?? lng,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * provider-types.ts — Normalized internal types for all provider responses.
 *
 * The app speaks these types. Providers are adapters to these types.
 * No Google-specific field names. No OSRM-specific field names. Just MEE.
 *
 * 💚 My Experience Engine — Provider layer
 */

export type ProviderName = 'google' | 'osrm' | 'nominatim' | 'photon' | 'overpass';

export interface GeocodingResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  segments: RouteSegmentResult[];
  fullGeometry: [number, number][];
  provider: ProviderName;
}

export interface RouteSegmentResult {
  from: { lat: number; lng: number; name?: string; id?: string };
  to: { lat: number; lng: number; name?: string; id?: string };
  distanceKm: number;
  durationMinutes: number;
  fuelNeededLitres: number;
  fuelCost: number;
}

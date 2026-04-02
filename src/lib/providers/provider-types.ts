/**
 * provider-types.ts — Normalized internal types for all provider responses.
 *
 * The app speaks these types. Providers are adapters to these types.
 * No Google-specific field names. No OSRM-specific field names. Just MEE.
 *
 * 💚 My Experience Engine — Provider layer
 */

export type ProviderName = 'google' | 'osrm' | 'nominatim' | 'overpass';

/** Carries an HTTP status code from a failed Google API response. */
export interface ProviderHttpError extends Error {
  readonly status: number;
  readonly name: 'ProviderHttpError';
}

/** Create a ProviderHttpError (use instanceof check via .name). */
export function makeProviderHttpError(message: string, status: number): ProviderHttpError {
  const err = new Error(message) as ProviderHttpError;
  Object.defineProperty(err, 'name', { value: 'ProviderHttpError' });
  Object.defineProperty(err, 'status', { value: status });
  return err;
}

export function isProviderHttpError(err: unknown): err is ProviderHttpError {
  return err instanceof Error && (err as ProviderHttpError).name === 'ProviderHttpError';
}

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

/**
 * geocoding-provider.ts — Location search dispatcher.
 *
 * Primary: Google Places (New) if key available
 * Fallback: Nominatim → Photon chain
 *
 * Consumers call searchLocations() via the api.ts barrel.
 * Never import adapters directly.
 *
 * 💚 My Experience Engine — Geocoding provider
 */

import type { GeocodingResult } from './provider-types';
import { getActiveGeocodingProvider } from './provider-config';
import { searchWithNominatim, searchWithPhoton } from '../api-geocoding';
import { recordProviderEvent } from './provider-telemetry';

// In-flight deduplication — same query never fires twice simultaneously
const inFlight = new Map<string, Promise<GeocodingResult[]>>();

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return [];

  if (inFlight.has(query)) return inFlight.get(query)!;

  const promise = _search(query).finally(() => inFlight.delete(query));
  inFlight.set(query, promise);
  return promise;
}

async function _search(query: string): Promise<GeocodingResult[]> {
  const primary = getActiveGeocodingProvider();
  const start = performance.now();

  // ── Google primary (Phase 2 — wired when google-geocoding.ts lands) ───
  if (primary === 'google') {
    try {
      const { searchWithGoogle } = await import('./google/google-geocoding');
      const results = await searchWithGoogle(query);
      recordProviderEvent('geocoding', 'google', 'success', performance.now() - start);
      if (results.length > 0) return results;
    } catch {
      recordProviderEvent('geocoding', 'google', 'failure', performance.now() - start);
      // fall through to Nominatim
    }
  }

  // ── Nominatim ─────────────────────────────────────────────────────────
  try {
    const results = await searchWithNominatim(query);
    recordProviderEvent('geocoding', 'nominatim', 'success', performance.now() - start);
    if (results.length > 0) return results;
  } catch {
    recordProviderEvent('geocoding', 'nominatim', 'failure', performance.now() - start);
  }

  // ── Photon last resort ────────────────────────────────────────────────
  try {
    const results = await searchWithPhoton(query);
    recordProviderEvent('geocoding', 'photon', 'success', performance.now() - start);
    return results;
  } catch {
    recordProviderEvent('geocoding', 'photon', 'failure', performance.now() - start);
    return [];
  }
}

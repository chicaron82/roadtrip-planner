/**
 * provider-config.ts — Provider selection and configuration.
 *
 * Reads VITE_GOOGLE_MAPS_KEY from environment.
 * Selects provider based on key availability — no key = public providers only.
 *
 * Provider-specific config lives here so the rest of the app
 * never needs to know about correction factors or proxy URLs.
 *
 * 💚 My Experience Engine — Provider config
 */

// ── API Keys ──────────────────────────────────────────────────────────────

export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';
export const hasGoogleKey = GOOGLE_MAPS_KEY.length > 0;

// ── Provider URLs ─────────────────────────────────────────────────────────

export const PROVIDER_URLS = {
  // Nominatim routes through Aaron's Cloudflare Worker proxy.
  // Direct browser requests to Nominatim are blocked (CORS).
  nominatim: 'https://nominatim-proxy.aaronsauddin.workers.dev',

  // Photon: fuzzy/typo-tolerant fallback. Missing major Canadian cities.
  photon: 'https://photon.komoot.io',

  // OSRM: public OSM routing server. CORS-friendly, no SLA.
  osrm: 'https://routing.openstreetmap.de/routed-car',

  // Google: new REST APIs with native CORS support.
  // Places API (New) — single-call search with coordinates.
  googlePlaces: 'https://places.googleapis.com/v1/places:searchText',
  // Places Nearby Search — POI discovery by location + type.
  googleNearby: 'https://places.googleapis.com/v1/places:searchNearby',
  // Routes API — CORS-friendly routing with encoded polylines.
  googleRoutes: 'https://routes.googleapis.com/directions/v2:computeRoutes',
} as const;

// ── Per-provider configuration ────────────────────────────────────────────

export const PROVIDER_CONFIG = {
  osrm: {
    // OSRM underestimates drive times. This factor is applied inside
    // api-routing.ts (fetchOSRMRoute). When OSRM is fully migrated
    // behind the seam, the factor moves to routing-provider.ts.
    durationCorrectionFactor: 0.85,
    timeoutMs: 15_000,
  },
  google: {
    // Google returns accurate durations natively — no correction.
    durationCorrectionFactor: 1.0,
    timeoutMs: 10_000,
  },
} as const;

// ── Provider selection ────────────────────────────────────────────────────

export function getActiveGeocodingProvider(): 'google' | 'nominatim' {
  return hasGoogleKey ? 'google' : 'nominatim';
}

export function getActiveRoutingProvider(): 'google' | 'osrm' {
  return hasGoogleKey ? 'google' : 'osrm';
}

export function getActivePOIProvider(): 'google' | 'overpass' {
  return hasGoogleKey ? 'google' : 'overpass';
}

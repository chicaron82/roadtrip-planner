/**
 * api.ts — Public interface for all external API calls.
 *
 * Re-exports from provider dispatchers:
 *   providers/geocoding-provider  — Location search (Google → Nominatim → Photon)
 *   providers/routing-provider    — Route calculation (Google → OSRM)
 *
 * Consumers should import from this barrel — never from adapters directly.
 */

export { searchLocations } from './providers/geocoding-provider';
export {
  fetchRouteGeometry,
  calculateRoute,
  fetchAllRouteStrategies,
  fetchOSRMRoute,
} from './providers/routing-provider';

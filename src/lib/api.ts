/**
 * api.ts — Public interface for all external API calls.
 *
 * Re-exports from focused modules:
 *   api-geocoding.ts  — Location search (Photon + Nominatim)
 *   api-routing.ts    — OSRM route fetching, strategy selection, border-corridor retry
 */

export { searchLocations } from './api-geocoding';
export {
  fetchRouteGeometry,
  calculateRoute,
  fetchAllRouteStrategies,
  fetchOSRMRoute,
} from './api-routing';

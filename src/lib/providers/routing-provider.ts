/**
 * routing-provider.ts — Route calculation dispatcher.
 *
 * Primary: Google Routes API (if key available)
 * Fallback: OSRM (routing.openstreetmap.de)
 *
 * CRITICAL: Duration correction is provider-specific.
 *   OSRM: × 0.85 (applied inside fetchOSRMRoute, kept there for now)
 *   Google: × 1.0 (accurate natively — no correction)
 *
 * fetchRouteGeometry and fetchAllRouteStrategies remain OSRM-only for now.
 * They're re-exported here for the api.ts barrel to stay clean.
 *
 * 💚 My Experience Engine — Routing provider
 */

import type { Location, RouteSegment } from '../../types';
import { getActiveRoutingProvider } from './provider-config';
import {
  calculateRoute as osrmCalculateRoute,
  fetchRouteGeometry,
  fetchAllRouteStrategies,
  fetchOSRMRoute,
} from '../api-routing';
import { recordProviderEvent } from './provider-telemetry';

// Re-export OSRM-only functions unchanged
export { fetchRouteGeometry, fetchAllRouteStrategies, fetchOSRMRoute };

export async function calculateRoute(
  locations: Location[],
  options?: { avoidTolls?: boolean; avoidBorders?: boolean; scenicMode?: boolean },
): Promise<{ segments: RouteSegment[]; fullGeometry: [number, number][] } | null> {
  const primary = getActiveRoutingProvider();
  const start = performance.now();

  // ── Google primary (Phase 2 — wired when google-routing.ts lands) ─────
  if (primary === 'google') {
    try {
      const { routeWithGoogle } = await import('./google/google-routing');
      const result = await routeWithGoogle(locations, options);
      if (result) {
        recordProviderEvent('routing', 'google', 'success', performance.now() - start);
        return result;
      }
    } catch {
      recordProviderEvent('routing', 'google', 'failure', performance.now() - start);
      // fall through to OSRM
    }
  }

  // ── OSRM fallback ─────────────────────────────────────────────────────
  try {
    const result = await osrmCalculateRoute(locations, options);
    if (result) {
      recordProviderEvent('routing', 'osrm', 'success', performance.now() - start);
      return result;
    }
  } catch {
    recordProviderEvent('routing', 'osrm', 'failure', performance.now() - start);
  }

  return null;
}

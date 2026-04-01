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

import type { Location, RouteSegment, RouteStrategy } from '../../types';
import { getActiveRoutingProvider } from './provider-config';
import {
  calculateRoute as osrmCalculateRoute,
  fetchRouteGeometry,
  fetchOSRMRoute,
} from '../api-routing';
import { detectBorderCrossing } from '../border-avoidance';
import { recordProviderEvent } from './provider-telemetry';

// Re-export OSRM-only functions unchanged
export { fetchRouteGeometry, fetchOSRMRoute };

export async function calculateRoute(
  locations: Location[],
  options?: { avoidTolls?: boolean; avoidBorders?: boolean; scenicMode?: boolean },
): Promise<{ segments: RouteSegment[]; fullGeometry: [number, number][] } | null> {
  const primary = getActiveRoutingProvider();
  const start = performance.now();

  // ── Google primary ─────────────────────────────────────────────────────
  // Skip Google when avoidBorders is requested — Google Routes API has no
  // country restriction. Our border avoidance uses OSRM guard waypoints.
  if (primary === 'google' && !options?.avoidBorders) {
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

// ── Strategy fetch (routes through the seam's calculateRoute) ───────────

const STRATEGIES = [
  { id: 'fastest' as const,     label: 'Fastest',     emoji: '⚡', avoidBorders: false, scenicMode: false },
  { id: 'canada-only' as const, label: 'Canada Only', emoji: '🍁', avoidBorders: true,  scenicMode: false },
  { id: 'scenic' as const,      label: 'Scenic',      emoji: '🌄', avoidBorders: false, scenicMode: true  },
];

export async function fetchAllRouteStrategies(
  locations: Location[],
  avoidTolls: boolean,
): Promise<RouteStrategy[]> {
  const results = await Promise.allSettled(
    STRATEGIES.map(s =>
      calculateRoute(locations, { avoidTolls, avoidBorders: s.avoidBorders, scenicMode: s.scenicMode }),
    ),
  );

  const out: RouteStrategy[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      const { segments, fullGeometry } = r.value;
      out.push({
        id: STRATEGIES[i].id,
        label: STRATEGIES[i].label,
        emoji: STRATEGIES[i].emoji,
        distanceKm: segments.reduce((sum, s) => sum + s.distanceKm, 0),
        durationMinutes: segments.reduce((sum, s) => sum + s.durationMinutes, 0),
        geometry: fullGeometry,
        segments,
      });
    }
  });

  if (out.length >= 2) {
    const fastest = out.find(s => s.id === 'fastest');
    if (fastest) {
      const { crossesUS } = detectBorderCrossing(fastest.geometry);
      return out.filter(s => {
        if (s.id === 'fastest') return true;
        if (s.id === 'canada-only') return crossesUS;
        const delta = Math.abs(s.distanceKm - fastest.distanceKm) / fastest.distanceKm;
        return delta > 0.03;
      });
    }
  }

  return out;
}

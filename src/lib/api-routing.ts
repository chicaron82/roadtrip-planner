/**
 * api-routing.ts — OSRM route fetching, strategy selection, and border-corridor retry.
 *
 * Handles:
 *  - fetchRouteGeometry  — lightweight geometry-only preview
 *  - calculateRoute      — full route with segments + guard-waypoint injection
 *  - fetchAllRouteStrategies — parallel fastest / canada-only / scenic fetch
 *  - fetchOSRMRoute      — raw OSRM call (extracted for retry paths)
 */
import type { Location, RouteSegment } from '../types';
import {
  detectBorderCrossing,
  getGuardWaypoints,
  insertGuardWaypoints,
  shouldTryLakeSuperiorCorridor,
} from './border-avoidance';
import { TRIP_CONSTANTS } from './trip-constants';

// ==================== ROUTING BASE URL ====================

/**
 * In dev, requests are proxied through Vite (/osrm → routing.openstreetmap.de)
 * to avoid CORS blocks from the browser. In production, we call the server directly.
 * Switch OSRM_PROD_BASE here when moving to a self-hosted instance.
 */
const OSRM_PROD_BASE = 'https://routing.openstreetmap.de/routed-car';
const OSRM_BASE = import.meta.env.DEV ? '/osrm' : OSRM_PROD_BASE;

// ==================== GEOMETRY PREVIEW ====================

/**
 * Lightweight geometry-only OSRM call. No segments, no cost calc, no weather.
 * Used by useEagerRoute to draw a preview line as soon as origin + destination are set.
 */
export async function fetchRouteGeometry(locations: Location[]): Promise<[number, number][] | null> {
  const valid = locations.filter(l => l.lat && l.lng && l.lat !== 0 && l.lng !== 0 && l.name);
  if (valid.length < 2) return null;
  const waypoints = valid.map(l => `${l.lng},${l.lat}`).join(';');
  try {
    const response = await fetch(
      `${OSRM_BASE}/route/v1/driving/${waypoints}?overview=simplified&geometries=geojson&steps=false`
    );
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as [number, number][];
  } catch {
    return null;
  }
}

// ==================== ROUTE CACHE ====================

const routeCache = new Map<string, string>();
const MAX_ROUTE_CACHE_SIZE = 20;

/** Set a cache entry, evicting the oldest when the cap is exceeded. */
function setCacheEntry(key: string, value: string): void {
  routeCache.set(key, value);
  if (routeCache.size > MAX_ROUTE_CACHE_SIZE) {
    routeCache.delete(routeCache.keys().next().value!);
  }
}

function getRouteCacheKey(locations: Location[], options?: { avoidTolls?: boolean; avoidBorders?: boolean; scenicMode?: boolean }): string {
  const locStr = locations.map(l => `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`).join('|');
  const optStr = `${options?.avoidTolls ? 'toll' : 'no'}-${options?.avoidBorders ? 'border' : 'no'}-${options?.scenicMode ? 'scenic' : 'no'}`;
  return `${locStr}=${optStr}`;
}

// ==================== ROUTE HELPERS ====================

function getRouteTotals(route: { segments: RouteSegment[] }): { distanceKm: number; durationMinutes: number } {
  return {
    distanceKm: route.segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    durationMinutes: route.segments.reduce((sum, segment) => sum + segment.durationMinutes, 0),
  };
}

function isComparableOrBetterRoute(
  candidate: { segments: RouteSegment[] },
  current: { segments: RouteSegment[] },
): boolean {
  const candidateTotals = getRouteTotals(candidate);
  const currentTotals = getRouteTotals(current);
  const tolerance = 1.02;

  return (
    candidateTotals.distanceKm <= currentTotals.distanceKm * tolerance &&
    candidateTotals.durationMinutes <= currentTotals.durationMinutes * tolerance
  );
}

// ==================== CALCULATE ROUTE ====================

export async function calculateRoute(
  locations: Location[],
  options?: { avoidTolls?: boolean; avoidBorders?: boolean; scenicMode?: boolean }
): Promise<{ segments: RouteSegment[], fullGeometry: [number, number][] } | null> {
  if (locations.length < 2) return null;

  const cacheKey = getRouteCacheKey(locations, options);
  if (routeCache.has(cacheKey)) {
    return JSON.parse(routeCache.get(cacheKey)!);
  }

  const parts: string[] = [];
  if (options?.avoidTolls) parts.push('toll');
  if (options?.scenicMode) parts.push('motorway');
  const excludeParam = parts.length > 0 ? `&exclude=${parts.join(',')}` : '';

  // First pass: calculate the route with requested exclusions.
  // If OSRM rejects the exclusion params (e.g. exclude=motorway returns 400 for some
  // cross-country routes on the public demo server), retry without any exclude param
  // so the app never hard-fails just because scenic/toll-avoidance isn't supported.
  // NOTE: DOMException (timeout / abort) is NOT retried — a slow/unreachable server
  //       won't improve on a second attempt and would double the wait time.
  let result: Awaited<ReturnType<typeof fetchOSRMRoute>>;
  try {
    result = await fetchOSRMRoute(locations, excludeParam);
  } catch {
    return null; // Timeout — don't retry
  }
  if (!result && excludeParam) {
    console.warn(`[api] OSRM rejected route with "${excludeParam}" — retrying without exclusions`);
    try {
      result = await fetchOSRMRoute(locations, '');
    } catch {
      return null;
    }
  }
  if (!result) return null;

  if (shouldTryLakeSuperiorCorridor(locations, result.fullGeometry)) {
    const lakeSuperiorGuards = getGuardWaypoints(new Set(['lakeSuperior']), locations);
    if (lakeSuperiorGuards.length > 0) {
      const reroutedLocations = insertGuardWaypoints(locations, lakeSuperiorGuards);
      let corridorResult: Awaited<ReturnType<typeof fetchOSRMRoute>> | null = null;
      try {
        corridorResult = await fetchOSRMRoute(reroutedLocations, excludeParam);
      } catch {
        corridorResult = null;
      }

      if (corridorResult && isComparableOrBetterRoute(corridorResult, result)) {
        result = corridorResult;
      }
    }
  }

  // If avoidBorders is enabled, check for border crossings and reroute
  if (options?.avoidBorders && result.fullGeometry.length > 0) {
    const { crossesUS, crossingRegions } = detectBorderCrossing(result.fullGeometry);

    if (crossesUS) {
      const guards = getGuardWaypoints(crossingRegions, locations);

      if (guards.length > 0) {
        const reroutedLocations = insertGuardWaypoints(locations, guards);
        let safeResult: Awaited<ReturnType<typeof fetchOSRMRoute>> | null = null;
        try {
          safeResult = await fetchOSRMRoute(reroutedLocations, excludeParam);
        } catch {
          safeResult = null; // Timeout — fall through to original route
        }

        if (safeResult) {
          setCacheEntry(cacheKey, JSON.stringify(safeResult));
          return safeResult;
        }
        // If reroute fails, fall through to the original route
      }
    }
  }

  setCacheEntry(cacheKey, JSON.stringify(result));
  return result;
}

// ==================== STRATEGY FETCH ====================

/**
 * Fetch all three named route strategies in parallel.
 * Returns whichever strategies OSRM successfully routes (may be fewer than 3
 * for short or single-country trips where avoidBorders makes no difference).
 */
export async function fetchAllRouteStrategies(
  locations: Location[],
  avoidTolls: boolean
): Promise<import('../types').RouteStrategy[]> {
  const strategies = [
    { id: 'fastest' as const,      label: 'Fastest',      emoji: '⚡', avoidBorders: false, scenicMode: false },
    { id: 'canada-only' as const,  label: 'Canada Only',  emoji: '🍁', avoidBorders: true,  scenicMode: false },
    { id: 'scenic' as const,       label: 'Scenic',       emoji: '🌄', avoidBorders: false, scenicMode: true  },
  ];

  const results = await Promise.allSettled(
    strategies.map(s =>
      calculateRoute(locations, { avoidTolls, avoidBorders: s.avoidBorders, scenicMode: s.scenicMode })
    )
  );

  const out: import('../types').RouteStrategy[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      const { segments, fullGeometry } = r.value;
      out.push({
        id: strategies[i].id,
        label: strategies[i].label,
        emoji: strategies[i].emoji,
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
      // Canada Only is a categorical choice (stay in Canada vs take the fastest path),
      // not a distance optimisation. Distance delta is the wrong filter — Winnipeg →
      // Niagara Falls via US vs via Lake Superior are similar in km but completely
      // different paths. Use border detection on the fastest geometry instead.
      const { crossesUS } = detectBorderCrossing(fastest.geometry);

      return out.filter(s => {
        if (s.id === 'fastest') return true;
        if (s.id === 'canada-only') return crossesUS; // show iff fastest cuts through the US
        const delta = Math.abs(s.distanceKm - fastest.distanceKm) / fastest.distanceKm;
        return delta > 0.03; // keep scenic only when meaningfully different
      });
    }
  }

  return out;
}

// ==================== OSRM CORE ====================

/**
 * Core OSRM route fetch — extracted so border avoidance can call it twice.
 */
export async function fetchOSRMRoute(
  locations: Location[],
  excludeParam: string
): Promise<{ segments: RouteSegment[], fullGeometry: [number, number][] } | null> {
  const validLocations = locations.filter(l => l.lat && l.lng && l.lat !== 0 && l.lng !== 0);
  if (validLocations.length < 2) return null;
  const waypoints = validLocations.map((loc) => `${loc.lng},${loc.lat}`).join(';');

  try {
    const response = await fetch(
      `${OSRM_BASE}/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=false${excludeParam}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!response.ok) return null;
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    const fullGeometry = route.geometry.coordinates.map((coord: number[]) => [
      coord[1],
      coord[0],
    ]) as [number, number][];

    const segments: RouteSegment[] = [];

    // OSRM returns legs between waypoints
    for (let i = 0; i < route.legs.length; i++) {
        const leg = route.legs[i];
        segments.push({
            from: validLocations[i],
            to: validLocations[i+1],
            distanceKm: leg.distance / 1000,
            // OSRM defaults to very conservative speeds. Apply a correction factor
            // to align closer with real-world Google Maps estimates.
            // Factor is defined in TRIP_CONSTANTS.routing.osrmDurationFactor.
            durationMinutes: (leg.duration / 60) * TRIP_CONSTANTS.routing.osrmDurationFactor,
            fuelNeededLitres: 0, // Calculated later
            fuelCost: 0, // Calculated later
        });
    }

    return { segments, fullGeometry };
  } catch (error) {
    // Re-throw abort/timeout errors so callers can distinguish them from "bad params"
    // (TimeoutError = server slow, AbortError = user cancelled — neither should trigger retry)
    if (error instanceof DOMException) throw error;
    console.error("Route calculation failed:", error);
    return null;
  }
}

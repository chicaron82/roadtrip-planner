import type { Location, RouteSegment } from '../types';
import { detectBorderCrossing, getGuardWaypoints, insertGuardWaypoints } from './border-avoidance';
import { NOMINATIM_BASE_URL } from './constants';
import { TRIP_CONSTANTS } from './trip-constants';

// ==================== GEOCODING ====================
// Primary: Photon (komoot) — fuzzy/typo-tolerant, built on Nominatim data, no key needed.
// Fallback: Nominatim — exact match only, used if Photon returns nothing.

interface PhotonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    locality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    type?: string;
    osm_type?: string;
  };
}

interface PhotonResponse {
  type: 'FeatureCollection';
  features: PhotonFeature[];
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/** Build a readable short name from Photon feature properties. */
function photonDisplayName(p: PhotonFeature['properties']): { name: string; address: string } {
  const parts: string[] = [];
  if (p.name) parts.push(p.name);
  if (p.city && p.city !== p.name) parts.push(p.city);
  else if (p.locality && p.locality !== p.name) parts.push(p.locality);
  if (p.state) parts.push(p.state);
  if (p.country) parts.push(p.country);

  const name = parts.slice(0, 2).join(', ');
  const address = parts.join(', ');
  return { name, address };
}

export async function searchLocations(query: string): Promise<Partial<Location>[]> {
  // ── Photon (fuzzy) ──────────────────────────────────────────────────────
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=7&lang=en`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data: PhotonResponse = await res.json();
      const results = data.features
        // Keep only point-like results that have usable coords + a name
        .filter(f => f.geometry?.coordinates?.length === 2 && (f.properties.name || f.properties.city))
        .map(f => {
          const [lng, lat] = f.geometry.coordinates;
          const { name, address } = photonDisplayName(f.properties);
          return {
            id: crypto.randomUUID(),
            lat,
            lng,
            name,
            address,
          } satisfies Partial<Location>;
        });

      // Deduplicate by name+country (Photon sometimes returns dupes at different zoom levels)
      const seen = new Set<string>();
      const deduped = results.filter(r => {
        const key = r.name?.toLowerCase() ?? '';
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (deduped.length > 0) return deduped.slice(0, 6);
    }
  } catch {
    // fall through to Nominatim
  }

  // ── Nominatim fallback (exact) ──────────────────────────────────────────
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'User-Agent': 'MyExperienceEngine/1.0' } }
    );
    const data: NominatimResult[] = await response.json();
    return data.map(item => ({
      id: crypto.randomUUID(),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: item.display_name.split(',').slice(0, 2).join(',').trim(),
      address: item.display_name,
    }));
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}


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
      `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=simplified&geometries=geojson&steps=false`
    );
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as [number, number][];
  } catch {
    return null;
  }
}

export async function calculateRoute(locations: Location[], options?: { avoidTolls?: boolean; avoidBorders?: boolean; scenicMode?: boolean }): Promise<{ segments: RouteSegment[], fullGeometry: [number, number][] } | null> {
  if (locations.length < 2) return null;

  const parts: string[] = [];
  if (options?.avoidTolls) parts.push('toll');
  if (options?.scenicMode) parts.push('motorway');
  const excludeParam = parts.length > 0 ? `&exclude=${parts.join(',')}` : '';

  // First pass: calculate the route with requested exclusions.
  // If OSRM rejects the exclusion params (e.g. exclude=motorway returns 400 for some
  // cross-country routes on the public demo server), retry without any exclude param
  // so the app never hard-fails just because scenic/toll-avoidance isn't supported.
  let result = await fetchOSRMRoute(locations, excludeParam);
  if (!result && excludeParam) {
    console.warn(`[api] OSRM rejected route with "${excludeParam}" — retrying without exclusions`);
    result = await fetchOSRMRoute(locations, '');
  }
  if (!result) return null;

  // If avoidBorders is enabled, check for border crossings and reroute
  if (options?.avoidBorders && result.fullGeometry.length > 0) {
    const { crossesUS, crossingRegions } = detectBorderCrossing(result.fullGeometry);

    if (crossesUS) {
      const guards = getGuardWaypoints(crossingRegions, locations);

      if (guards.length > 0) {
        const reroutedLocations = insertGuardWaypoints(locations, guards);
        const safeResult = await fetchOSRMRoute(reroutedLocations, excludeParam);

        if (safeResult) {
          // Return the safe route but map segments back to original locations
          // (guard waypoints appear as intermediate stops)
          return safeResult;
        }
        // If reroute fails, fall through to the original route
      }
    }
  }

  return result;
}

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

/**
 * Core OSRM route fetch — extracted so border avoidance can call it twice.
 */
async function fetchOSRMRoute(
  locations: Location[],
  excludeParam: string
): Promise<{ segments: RouteSegment[], fullGeometry: [number, number][] } | null> {
  const waypoints = locations.map((loc) => `${loc.lng},${loc.lat}`).join(';');

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=false${excludeParam}`
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
            from: locations[i],
            to: locations[i+1],
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
    console.error("Route calculation failed:", error);
    return null;
  }
}

/**
 * Border Avoidance Utility
 *
 * Detects if a route crosses the US/Canada border and provides
 * Canadian corridor waypoints to reroute around it.
 *
 * The public OSRM server doesn't support exclude=border_crossing,
 * so we detect crossings from the route geometry and inject guard
 * waypoints to keep the route in-country.
 */
import type { Location } from '../types';

// ==================== BORDER DETECTION ====================

/**
 * Simplified US/Canada border approximation by longitude band.
 * Returns the approximate latitude of the border at a given longitude.
 * Points below this latitude are likely in the US.
 *
 * This is intentionally conservative — some Canadian cities (Windsor, Pelee)
 * sit below 49°N, so we use tighter thresholds in those regions.
 */
function getBorderLatitude(lng: number): number {
  // Alaska/Yukon border (west of -141°)
  if (lng < -141) return 60;

  // BC/Washington border to Manitoba/Minnesota (~49th parallel)
  if (lng < -95) return 49.0;

  // Ontario/Minnesota-Wisconsin (Lake Superior region)
  if (lng < -89) return 47.5;

  // Northern Great Lakes (above Lake Huron/Superior)
  if (lng < -84) return 46.0;

  // Southern Ontario / Great Lakes (Windsor is at 42.3°N, Point Pelee at 41.9°N)
  // The border follows the middle of the Great Lakes here
  if (lng < -79) return 41.5;

  // Niagara / Lake Ontario / St. Lawrence
  if (lng < -75) return 43.5;

  // Quebec / Vermont-NY border
  if (lng < -71) return 45.0;

  // Quebec-Maine / New Brunswick-Maine border
  if (lng < -67) return 45.5;

  // Maritime provinces
  return 44.5;
}

/**
 * Check if a coordinate is likely in the US (south of the border).
 * Uses the simplified border approximation above.
 * Exported so segment-analyzer can reuse geometry-based detection instead of string heuristics.
 */
export function isLikelyInUS(lat: number, lng: number): boolean {
  // Only applies to North American longitudes
  if (lng < -170 || lng > -50) return false;

  const borderLat = getBorderLatitude(lng);
  return lat < borderLat;
}

/**
 * Sample a route geometry and detect if any points cross into the US.
 * Returns the indices of border-crossing segments for diagnostics.
 */
export function detectBorderCrossing(geometry: [number, number][]): {
  crossesUS: boolean;
  crossingRegions: Set<string>;
} {
  if (geometry.length < 2) return { crossesUS: false, crossingRegions: new Set() };

  const crossingRegions = new Set<string>();

  // Sample every ~5km worth of points (roughly every 20th point for long routes)
  const step = Math.max(1, Math.floor(geometry.length / 200));

  for (let i = 0; i < geometry.length; i += step) {
    const [lat, lng] = geometry[i];
    if (isLikelyInUS(lat, lng)) {
      // Categorize which region the crossing is in
      if (lng < -95) crossingRegions.add('west');
      else if (lng < -84) crossingRegions.add('lakeSuperior');
      else if (lng < -75) crossingRegions.add('southernOntario');
      else if (lng < -67) crossingRegions.add('quebec');
      else crossingRegions.add('maritimes');
    }
  }

  return {
    crossesUS: crossingRegions.size > 0,
    crossingRegions,
  };
}

// ==================== GUARD WAYPOINTS ====================

/**
 * Canadian corridor waypoints that force routes to stay north of the border.
 * Organized by region — we only inject waypoints for regions where
 * a crossing was detected.
 */
const GUARD_WAYPOINTS: Record<string, Location[]> = {
  // Western Canada (BC interior → Prairies)
  west: [
    { id: 'guard-kamloops', name: 'Kamloops, BC', lat: 50.67, lng: -120.33, type: 'waypoint' },
    { id: 'guard-regina', name: 'Regina, SK', lat: 50.45, lng: -104.62, type: 'waypoint' },
  ],

  // Lake Superior corridor (Ontario → Manitoba)
  lakeSuperior: [
    { id: 'guard-ssm', name: 'Sault Ste. Marie, ON', lat: 46.52, lng: -84.35, type: 'waypoint' },
    { id: 'guard-thunderbay', name: 'Thunder Bay, ON', lat: 48.38, lng: -89.25, type: 'waypoint' },
    { id: 'guard-kenora', name: 'Kenora, ON', lat: 49.77, lng: -94.49, type: 'waypoint' },
  ],

  // Southern Ontario (Niagara / Windsor corridor)
  southernOntario: [
    { id: 'guard-london', name: 'London, ON', lat: 42.98, lng: -81.25, type: 'waypoint' },
    { id: 'guard-barrie', name: 'Barrie, ON', lat: 44.39, lng: -79.69, type: 'waypoint' },
  ],

  // Quebec / Vermont-NY border
  quebec: [
    { id: 'guard-sherbrooke', name: 'Sherbrooke, QC', lat: 45.40, lng: -71.89, type: 'waypoint' },
    { id: 'guard-riviereduloup', name: 'Rivière-du-Loup, QC', lat: 47.83, lng: -69.53, type: 'waypoint' },
  ],

  // Maritimes / Maine border
  maritimes: [
    { id: 'guard-edmundston', name: 'Edmundston, NB', lat: 47.37, lng: -68.32, type: 'waypoint' },
    { id: 'guard-fredericton', name: 'Fredericton, NB', lat: 45.96, lng: -66.64, type: 'waypoint' },
  ],
};

/**
 * Given a set of crossing regions, return the guard waypoints needed
 * to keep the route in Canada. Waypoints are sorted west-to-east
 * by longitude so they fit naturally into the route.
 */
export function getGuardWaypoints(
  crossingRegions: Set<string>,
  existingLocations: Location[]
): Location[] {
  const guards: Location[] = [];

  for (const region of crossingRegions) {
    const regionWaypoints = GUARD_WAYPOINTS[region];
    if (regionWaypoints) {
      // Only add waypoints that aren't too close to existing locations
      for (const wp of regionWaypoints) {
        const tooClose = existingLocations.some(
          (loc) => Math.abs(loc.lat - wp.lat) < 0.5 && Math.abs(loc.lng - wp.lng) < 0.5
        );
        if (!tooClose) {
          guards.push(wp);
        }
      }
    }
  }

  // Sort west-to-east by longitude
  guards.sort((a, b) => a.lng - b.lng);

  return guards;
}

/**
 * Insert guard waypoints into the locations array between origin and destination.
 * Guard waypoints are placed in route order (sorted by longitude proximity
 * to the travel direction).
 */
export function insertGuardWaypoints(
  originalLocations: Location[],
  guards: Location[]
): Location[] {
  if (guards.length === 0) return originalLocations;

  const origin = originalLocations[0];
  const destination = originalLocations[originalLocations.length - 1];
  const existingWaypoints = originalLocations.slice(1, -1);

  // Only insert guards that lie within the O→D longitude corridor.
  // Guards outside this range (e.g. SSM east of Thunder Bay, Kamloops west of
  // Winnipeg) would force the route to backtrack, making things worse.
  const minLng = Math.min(origin.lng, destination.lng);
  const maxLng = Math.max(origin.lng, destination.lng);
  const relevantGuards = guards.filter(
    g => g.lng >= minLng - 0.5 && g.lng <= maxLng + 0.5
  );

  if (relevantGuards.length === 0) return originalLocations;

  // Merge existing waypoints + relevant guard waypoints, sort by longitude
  // in the direction of travel (west-to-east or east-to-west)
  const travelingEast = destination.lng > origin.lng;
  const allWaypoints = [...existingWaypoints, ...relevantGuards];
  allWaypoints.sort((a, b) =>
    travelingEast ? a.lng - b.lng : b.lng - a.lng
  );

  return [origin, ...allWaypoints, destination];
}

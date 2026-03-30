/**
 * geo-utils.ts — Haversine distance and route-geometry helpers.
 *
 * Extracted from poi-ranking.ts. These are general-purpose geospatial
 * utilities used across the codebase (fuel snapping, hub cache, overnight
 * snapping, route geocoding, stop suggestions, etc.).
 *
 * 💚 My Experience Engine
 */

import type { POISuggestion, RouteSegment } from '../types';

/**
 * Calculate straight-line distance between two points (Haversine formula).
 * Returns distance in kilometers.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate minimum distance from a POI to a route polyline using true
 * perpendicular point-to-segment projection (flat-earth approximation).
 * Returns { distanceKm, nearestSegmentIndex, nearestPoint }.
 */
export function distanceToRoute(
  poi: POISuggestion,
  routeGeometry: [number, number][]
): { distanceKm: number; nearestSegmentIndex: number; nearestPoint: [number, number] } {
  let minDistance = Infinity;
  let nearestSegmentIndex = 0;
  let nearestPoint: [number, number] = routeGeometry[0];

  for (let i = 0; i < routeGeometry.length - 1; i++) {
    const [lat1, lng1] = routeGeometry[i];
    const [lat2, lng2] = routeGeometry[i + 1];

    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    const lenSq = dx * dx + dy * dy;

    let nearLat: number;
    let nearLng: number;

    if (lenSq === 0) {
      // Degenerate segment (zero-length) — use the endpoint
      nearLat = lat1;
      nearLng = lng1;
    } else {
      // Perpendicular projection: t = ((P-P1)·(P2-P1)) / |P2-P1|²
      const t = Math.max(0, Math.min(1,
        ((poi.lat - lat1) * dx + (poi.lng - lng1) * dy) / lenSq
      ));
      nearLat = lat1 + t * dx;
      nearLng = lng1 + t * dy;
    }

    const dist = haversineDistance(poi.lat, poi.lng, nearLat, nearLng);

    if (dist < minDistance) {
      minDistance = dist;
      nearestSegmentIndex = i;
      nearestPoint = [nearLat, nearLng];
    }
  }

  return {
    distanceKm: minDistance,
    nearestSegmentIndex,
    nearestPoint,
  };
}

/**
 * Estimate detour time based on distance from route.
 * Uses the actual driving speed of the nearest segment rather than a flat 60 km/h,
 * so highway drivers don't get over-penalised for the same detour distance.
 * Speed is clamped to 40–120 km/h to guard against degenerate segment data.
 */
export function estimateDetourTime(distanceFromRouteKm: number, drivingSpeedKmh = 60): number {
  const roundTripKm = distanceFromRouteKm * 2;
  const detourHours = roundTripKm / drivingSpeedKmh;
  return Math.round(detourHours * 60); // Convert to minutes
}

/**
 * Find which route segment a POI falls nearest to.
 * Compares against each segment's `to` location (arrival point).
 * Returns the segment index suitable for `afterSegmentIndex`.
 */
export function findNearestSegmentIndex(
  lat: number,
  lng: number,
  segments: RouteSegment[]
): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    const to = segments[i].to;
    const dist = haversineDistance(lat, lng, to.lat, to.lng);
    if (dist < minDist) {
      minDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

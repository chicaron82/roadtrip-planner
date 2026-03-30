import type { RouteSegment } from '../../types';
import { cacheDiscoveredHub, findPreferredHubInWindow } from '../hub-cache';
import { haversineDistance } from '../geo-utils';
import { interpolateRoutePosition } from '../route-geocoder';

export interface StopPlanningRouteContext {
  totalRouteDistanceKm: number;
  getGeometryPosition: (km: number) => { lat: number; lng: number } | undefined;
  getHubNameAtKm: (km: number, windowKm?: number) => string | undefined;
}

export function prewarmWaypointHubs(segments: RouteSegment[]): void {
  const prewarmPoints = [segments[0]?.from, ...segments.map(segment => segment.to)];

  for (const point of prewarmPoints) {
    if (point?.name && point.lat != null && point.lng != null && !/unorganized/i.test(point.name)) {
      cacheDiscoveredHub({
        name: point.name,
        lat: point.lat,
        lng: point.lng,
        radius: 25,
        poiCount: 5,
        discoveredAt: new Date().toISOString(),
        source: 'discovered',
      });
    }
  }
}

export function createStopPlanningRouteContext(
  segments: RouteSegment[],
  fullGeometry?: number[][],
): StopPlanningRouteContext {
  const totalRouteDistanceKm = segments.reduce((sum, seg) => sum + seg.distanceKm, 0);
  const originName = segments[0]?.from.name;
  const destinationName = segments[segments.length - 1]?.to.name;
  const isRoundTrip = !!originName && originName === destinationName;
  const geometryCoversRoundTrip = !!(
    isRoundTrip &&
    fullGeometry &&
    fullGeometry.length > 1 &&
    haversineDistance(
      fullGeometry[0][0],
      fullGeometry[0][1],
      fullGeometry[fullGeometry.length - 1][0],
      fullGeometry[fullGeometry.length - 1][1],
    ) < 5
  );
  const outboundTotalKm = isRoundTrip ? totalRouteDistanceKm / 2 : totalRouteDistanceKm;

  const toGeometryKm = (km: number): number => {
    if (isRoundTrip && !geometryCoversRoundTrip && km > outboundTotalKm) {
      return Math.max(0, outboundTotalKm - (km - outboundTotalKm));
    }

    return km;
  };

  const getGeometryPosition = (km: number): { lat: number; lng: number } | undefined => {
    if (!fullGeometry || fullGeometry.length <= 1) return undefined;
    return interpolateRoutePosition(fullGeometry, toGeometryKm(km)) ?? undefined;
  };

  const getHubNameAtKm = (km: number, windowKm: number = 80): string | undefined => {
    const pos = getGeometryPosition(km);
    if (!pos) return undefined;
    return findPreferredHubInWindow(pos.lat, pos.lng, windowKm)?.name;
  };

  return {
    totalRouteDistanceKm,
    getGeometryPosition,
    getHubNameAtKm,
  };
}
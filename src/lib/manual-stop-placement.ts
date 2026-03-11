import type { RouteSegment } from '../types';
import { haversineDistance } from './poi-ranking';
import { getTripStartTime } from './trip-timezone';

interface ManualStopPlacementOptions {
  lat: number;
  lng: number;
  segments: RouteSegment[];
  fullGeometry?: number[][];
  totalDurationMinutes: number;
  departureDate: string;
  departureTime: string;
  originLng?: number;
  fallbackSegmentIndex: number;
}

export interface ManualStopPlacement {
  afterSegmentIndex: number;
  estimatedTime: Date;
  distanceFromStartKm: number;
}

interface GeometryProjection {
  distanceAlongKm: number;
}

function projectDistanceAlongGeometry(
  lat: number,
  lng: number,
  geometry: number[][],
): GeometryProjection | null {
  if (geometry.length < 2) return null;

  let accumulatedKm = 0;
  let bestDistanceKm = Number.POSITIVE_INFINITY;
  let bestDistanceAlongKm = 0;

  for (let index = 0; index < geometry.length - 1; index++) {
    const [lat1, lng1] = geometry[index];
    const [lat2, lng2] = geometry[index + 1];
    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    const lengthSquared = dx * dx + dy * dy;

    let progress = 0;
    if (lengthSquared > 0) {
      progress = Math.max(0, Math.min(1, ((lat - lat1) * dx + (lng - lng1) * dy) / lengthSquared));
    }

    const nearLat = lat1 + dx * progress;
    const nearLng = lng1 + dy * progress;
    const segmentKm = haversineDistance(lat1, lng1, lat2, lng2);
    const distanceKm = haversineDistance(lat, lng, nearLat, nearLng);

    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestDistanceAlongKm = accumulatedKm + segmentKm * progress;
    }

    accumulatedKm += segmentKm;
  }

  return { distanceAlongKm: bestDistanceAlongKm };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildFallbackDistanceKm(segments: RouteSegment[], fallbackSegmentIndex: number): number {
  if (segments.length === 0) return 0;

  const boundedIndex = clamp(fallbackSegmentIndex, 0, segments.length - 1);
  const distanceBeforeSegment = segments
    .slice(0, boundedIndex)
    .reduce((sum, segment) => sum + segment.distanceKm, 0);
  const segmentDistanceKm = segments[boundedIndex]?.distanceKm ?? 0;

  return distanceBeforeSegment + segmentDistanceKm * 0.5;
}

export function deriveManualStopPlacement({
  lat,
  lng,
  segments,
  fullGeometry,
  totalDurationMinutes,
  departureDate,
  departureTime,
  originLng,
  fallbackSegmentIndex,
}: ManualStopPlacementOptions): ManualStopPlacement {
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const projectedDistanceKm = projectDistanceAlongGeometry(lat, lng, fullGeometry ?? [])?.distanceAlongKm
    ?? buildFallbackDistanceKm(segments, fallbackSegmentIndex);
  const distanceFromStartKm = clamp(projectedDistanceKm, 0, totalDistanceKm);

  let accumulatedKm = 0;
  let segmentIndex = 0;
  for (let index = 0; index < segments.length; index++) {
    const nextAccumulatedKm = accumulatedKm + segments[index].distanceKm;
    if (distanceFromStartKm <= nextAccumulatedKm || index === segments.length - 1) {
      segmentIndex = index;
      break;
    }
    accumulatedKm = nextAccumulatedKm;
  }

  const segmentDistanceKm = Math.max(segments[segmentIndex]?.distanceKm ?? 1, 1);
  const distanceIntoSegmentKm = clamp(distanceFromStartKm - accumulatedKm, 0, segmentDistanceKm);
  const fractionWithinSegment = clamp(distanceIntoSegmentKm / segmentDistanceKm, 0.01, 0.99);
  const afterSegmentIndex = segmentIndex === 0
    ? -1 + fractionWithinSegment
    : (segmentIndex - 1) + fractionWithinSegment;

  const startTime = getTripStartTime(departureDate, departureTime, originLng);
  const progress = totalDistanceKm > 0 ? distanceFromStartKm / totalDistanceKm : 0;
  const estimatedTime = new Date(startTime.getTime() + totalDurationMinutes * progress * 60_000);

  return {
    afterSegmentIndex,
    estimatedTime,
    distanceFromStartKm,
  };
}
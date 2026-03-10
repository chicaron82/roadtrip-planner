import type { ProcessedSegment, RouteSegment } from '../types';
import type { SuggestedStop } from './stop-suggestions';

export interface TimelineLocationResolver {
  makeLocationHint: (km: number, wpName?: string, hubName?: string) => string;
  resolveWaypointName: (stop: SuggestedStop, currentKm: number) => string | undefined;
}

export function buildSegmentEndKm(segments: Array<Pick<RouteSegment, 'distanceKm'>>): number[] {
  const segmentEndKm: number[] = [];
  let acc = 0;
  for (const segment of segments) {
    acc += segment.distanceKm;
    segmentEndKm.push(acc);
  }
  return segmentEndKm;
}

export function createTimelineLocationResolver(
  originName: string,
  segments: RouteSegment[],
  segEndKm: number[],
  iterSegments: ProcessedSegment[],
  iterSegEndKm: number[],
): TimelineLocationResolver {
  const normalizedOriginName = originName.trim();
  const routeEndpointNames = new Set<string>();
  const endpointBoundariesByName = new Map<string, number[]>();

  const addBoundary = (name: string | undefined, km: number): void => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    routeEndpointNames.add(trimmed);
    const existing = endpointBoundariesByName.get(trimmed);
    if (existing) {
      existing.push(km);
    } else {
      endpointBoundariesByName.set(trimmed, [km]);
    }
  };

  addBoundary(normalizedOriginName, 0);
  if (segEndKm.length > 0) {
    segments.forEach((segment, index) => addBoundary(segment.to.name, segEndKm[index] ?? 0));
  }

  const isNearTrueBoundary = (name: string, currentKm: number): boolean => {
    const boundaries = endpointBoundariesByName.get(name.trim()) ?? [];
    return boundaries.some(boundaryKm => Math.abs(currentKm - boundaryKm) <= 60);
  };

  const isResolvedLabelUsable = (name?: string, currentKm?: number): boolean => {
    if (!name) return false;
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes('(transit)')) return false;
    if (/unorganized/i.test(trimmed)) return false;

    // Only show route endpoint labels when the current stop is actually near one
    // of that endpoint's real boundaries. This prevents round-trip endpoint names
    // from leaking onto transit fuel stops due to split-segment naming.
    if (
      routeEndpointNames.has(trimmed) &&
      currentKm !== undefined &&
      !isNearTrueBoundary(trimmed, currentKm)
    ) {
      return false;
    }

    return true;
  };

  const makeLocationHint = (km: number, wpName?: string, hubName?: string): string => {
    if (km < 20) return wpName ?? originName;
    if (isResolvedLabelUsable(wpName, km)) return wpName!;
    // Hub names come from a geographic proximity lookup and are already position-
    // validated — skip the endpoint-boundary guard that isResolvedLabelUsable applies,
    // which incorrectly rejects names that happen to match a route waypoint (e.g.
    // "Thunder Bay" for a stop 80 km before Thunder Bay).
    if (hubName && hubName.trim() && !/unorganized/i.test(hubName)) {
      const trimmed = hubName.trim();
      // Apply the same endpoint-leakage guard for hub names that match route endpoints
      if (routeEndpointNames.has(trimmed) && !isNearTrueBoundary(trimmed, km)) {
        // Fall through to km-based hint
      } else {
        return `near ${trimmed}`;
      }
    }
    const rounded = Math.round(km / 5) * 5;
    return `~${rounded} km into trip`;
  };

  const resolveWaypointName = (stop: SuggestedStop, currentKm: number): string | undefined => {
    const idx = stop.afterSegmentIndex;
    if (idx >= 0 && idx < segments.length) {
      const endKm = segEndKm[idx];
      if (endKm !== undefined && Math.abs(currentKm - endKm) <= 30) {
        const candidate = segments[idx].to.name;
        if (isResolvedLabelUsable(candidate, currentKm)) return candidate;
      }
    }

    for (let i = 0; i < segments.length; i++) {
      if (Math.abs(currentKm - segEndKm[i]) <= 20) {
        const candidate = segments[i].to.name;
        if (isResolvedLabelUsable(candidate, currentKm)) return candidate;
      }
    }

    for (let i = 0; i < iterSegEndKm.length; i++) {
      if (Math.abs(currentKm - iterSegEndKm[i]) <= 20) {
        const name = iterSegments[i]?.to.name;
        if (isResolvedLabelUsable(name, currentKm)) return name;
      }
    }

    return undefined;
  };

  return { makeLocationHint, resolveWaypointName };
}
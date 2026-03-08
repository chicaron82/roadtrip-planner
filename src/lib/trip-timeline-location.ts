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
  const finalDestinationName = segments.at(-1)?.to.name?.trim();
  const totalRouteKm = segEndKm.at(-1) ?? 0;

  const isWaypointLabelUsable = (name?: string, currentKm?: number): boolean => {
    if (!name) return false;
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes('(transit)')) return false;
    if (/unorganized/i.test(trimmed)) return false;

    // Long split segments can carry the trip endpoint name on intermediate
    // transit parts. Don't let an en-route fuel stop near Lake Charles get
    // labeled as "Disneyland, Anaheim" just because the parent segment ends there.
    if (
      finalDestinationName &&
      trimmed === finalDestinationName &&
      currentKm !== undefined &&
      totalRouteKm - currentKm > 60
    ) {
      return false;
    }

    return true;
  };

  const makeLocationHint = (km: number, wpName?: string, hubName?: string): string => {
    if (km < 20) return wpName ?? originName;
    if (isWaypointLabelUsable(wpName, km)) return wpName!;
    if (hubName && !/unorganized/i.test(hubName)) return `near ${hubName}`;
    const rounded = Math.round(km / 5) * 5;
    return `~${rounded} km into trip`;
  };

  const resolveWaypointName = (stop: SuggestedStop, currentKm: number): string | undefined => {
    const idx = stop.afterSegmentIndex;
    if (idx >= 0 && idx < segments.length) {
      const endKm = segEndKm[idx];
      if (endKm !== undefined && Math.abs(currentKm - endKm) <= 30) {
        const candidate = segments[idx].to.name;
        if (isWaypointLabelUsable(candidate, currentKm)) return candidate;
      }
    }

    for (let i = 0; i < segments.length; i++) {
      if (Math.abs(currentKm - segEndKm[i]) <= 20) {
        const candidate = segments[i].to.name;
        if (isWaypointLabelUsable(candidate, currentKm)) return candidate;
      }
    }

    for (let i = 0; i < iterSegEndKm.length; i++) {
      if (Math.abs(currentKm - iterSegEndKm[i]) <= 20) {
        const name = iterSegments[i]?.to.name;
        if (isWaypointLabelUsable(name, currentKm)) return name;
      }
    }

    return undefined;
  };

  return { makeLocationHint, resolveWaypointName };
}
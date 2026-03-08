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
  const makeLocationHint = (km: number, wpName?: string, hubName?: string): string => {
    if (km < 20) return wpName ?? originName;
    if (wpName && !/unorganized/i.test(wpName)) return wpName;
    if (hubName && !/unorganized/i.test(hubName)) return `near ${hubName}`;
    const rounded = Math.round(km / 5) * 5;
    return `~${rounded} km into trip`;
  };

  const resolveWaypointName = (stop: SuggestedStop, currentKm: number): string | undefined => {
    const idx = stop.afterSegmentIndex;
    if (idx >= 0 && idx < segments.length) {
      const endKm = segEndKm[idx];
      if (endKm !== undefined && Math.abs(currentKm - endKm) <= 30) {
        return segments[idx].to.name;
      }
    }

    for (let i = 0; i < segments.length; i++) {
      if (Math.abs(currentKm - segEndKm[i]) <= 20) {
        return segments[i].to.name;
      }
    }

    for (let i = 0; i < iterSegEndKm.length; i++) {
      if (Math.abs(currentKm - iterSegEndKm[i]) <= 20) {
        const name = iterSegments[i]?.to.name;
        if (name && !name.includes('(transit)')) return name;
      }
    }

    return undefined;
  };

  return { makeLocationHint, resolveWaypointName };
}
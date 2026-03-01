import type { TripDay, ProcessedSegment, RouteSegment } from '../types';

export interface FlatSegment {
  seg: ProcessedSegment;
  flatIdx: number;
}

export interface FlattenResult {
  /** Flat list of processed sub-segments across all driving days. */
  segments: FlatSegment[];
  /** flatIdx → TripDay for every driving-day boundary (2nd day onwards). */
  dayBoundaries: Map<number, TripDay>;
}

/**
 * Build a flat iteration list from processed sub-segments across driving days.
 *
 * This is the single source of truth for flat-index computation. Used by:
 * - buildSimulationItems (timeline simulation)
 * - generateSmartStops (stop suggestion engine)
 * - useTimelineData (dayStartMap / freeDaysAfterSegment)
 *
 * When `days` is not available, falls back to wrapping `originalSegments` as
 * ProcessedSegments with `_originalIndex = array index`.
 */
export function flattenDrivingSegments(
  originalSegments: RouteSegment[],
  days: TripDay[] | undefined,
): FlattenResult {
  const segments: FlatSegment[] = [];
  const dayBoundaries = new Map<number, TripDay>();

  if (days) {
    let flatIdx = 0;
    const drivingDays = days.filter(d => d.segmentIndices.length > 0);
    for (let di = 0; di < drivingDays.length; di++) {
      const day = drivingDays[di];
      if (di > 0) dayBoundaries.set(flatIdx, day);
      for (const seg of day.segments) {
        segments.push({ seg, flatIdx });
        flatIdx++;
      }
    }
  } else {
    for (let i = 0; i < originalSegments.length; i++) {
      const processed: ProcessedSegment = { ...originalSegments[i], _originalIndex: i };
      segments.push({ seg: processed, flatIdx: i });
    }
  }

  return { segments, dayBoundaries };
}

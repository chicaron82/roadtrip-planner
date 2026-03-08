import type { TripDay } from '../types';
import type { CanonicalTripDay } from './canonical-trip';

export interface DayStartEntry {
  day: TripDay;
  isFirst: boolean;
}

interface DayPlacementMapsResult {
  dayStartMap: Map<number, DayStartEntry[]>;
  freeDaysAfterSegment: Map<number, TripDay[]>;
}

type DayPlacementKeyMode = 'flat' | 'original';

function getEventIndex(day: CanonicalTripDay, mode: DayPlacementKeyMode, edge: 'first' | 'last'): number | undefined {
  const events = edge === 'first' ? day.events : [...day.events].reverse();
  const event = events.find(candidate =>
    (candidate.type === 'waypoint' || candidate.type === 'arrival') &&
    (mode === 'flat'
      ? candidate.flatIndex !== undefined
      : (candidate.originalIndex ?? candidate.flatIndex) !== undefined),
  );

  if (!event) return undefined;
  return mode === 'flat' ? event.flatIndex : (event.originalIndex ?? event.flatIndex);
}

function buildFallbackBounds(days: CanonicalTripDay[], mode: DayPlacementKeyMode): Map<number, { start: number; end: number }> {
  const bounds = new Map<number, { start: number; end: number }>();
  let nextFlatIndex = 0;

  days.forEach(day => {
    if (day.meta.segmentIndices.length === 0) return;

    if (mode === 'flat') {
      const start = nextFlatIndex;
      const end = start + Math.max(day.meta.segments.length - 1, 0);
      bounds.set(day.meta.dayNumber, { start, end });
      nextFlatIndex += day.meta.segments.length;
      return;
    }

    const start = day.meta.segmentIndices[0];
    const end = day.meta.segmentIndices[day.meta.segmentIndices.length - 1];
    if (start !== undefined && end !== undefined) {
      bounds.set(day.meta.dayNumber, { start, end });
    }
  });

  return bounds;
}

export function buildDayPlacementMaps(
  days: CanonicalTripDay[],
  mode: DayPlacementKeyMode,
): DayPlacementMapsResult {
  const dayStartMap = new Map<number, DayStartEntry[]>();
  const freeDaysAfterSegment = new Map<number, TripDay[]>();
  const firstDrivingDayNumber = days.find(day => day.meta.segmentIndices.length > 0)?.meta.dayNumber;
  const fallbackBounds = buildFallbackBounds(days, mode);

  days.forEach(day => {
    if (day.meta.segmentIndices.length === 0) return;

    const startIndex = getEventIndex(day, mode, 'first') ?? fallbackBounds.get(day.meta.dayNumber)?.start;
    if (startIndex !== undefined) {
      const existing = dayStartMap.get(startIndex) ?? [];
      dayStartMap.set(startIndex, [...existing, { day: day.meta, isFirst: day.meta.dayNumber === firstDrivingDayNumber }]);
    }
  });

  let lastDrivingIndex: number | undefined;
  days.forEach(day => {
    if (day.meta.segmentIndices.length > 0) {
      lastDrivingIndex = getEventIndex(day, mode, 'last') ?? fallbackBounds.get(day.meta.dayNumber)?.end;
      return;
    }

    if (lastDrivingIndex !== undefined) {
      const existing = freeDaysAfterSegment.get(lastDrivingIndex) ?? [];
      freeDaysAfterSegment.set(lastDrivingIndex, [...existing, day.meta]);
    }
  });

  return { dayStartMap, freeDaysAfterSegment };
}
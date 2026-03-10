/**
 * trip-timeline-helpers.ts — Pure utility functions for the timed event builder.
 *
 * Extracted from trip-timeline.ts to keep individually testable and reusable:
 *   - formatTime / formatDuration  — display formatting
 *   - stopTypeToEventType          — enum mapping
 *   - classifyStops                — stop-partition algorithm (the complex one)
 *
 * Nothing here has side effects or shared state.
 */

import type { SuggestedStop } from './stop-suggestions';
import type { TimedEventType } from './trip-timeline-types';
import { formatTimeInZone } from './trip-timezone';

// ─── Display formatting ────────────────────────────────────────────────────────

/**
 * Format a Date as "9:00 AM" / "12:15 PM" in the given IANA timezone.
 * Falls back to browser local time when no timezone provided (legacy).
 */
export const formatTime = (d: Date, ianaTimezone?: string): string =>
  formatTimeInZone(d, ianaTimezone);

/**
 * Format a duration in minutes as "1h 15min" / "45 min"
 */
export const formatDuration = (minutes: number): string => {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}min`;
};

// ─── Enum mapping ─────────────────────────────────────────────────────────────

/**
 * Map a SuggestedStop type to a TimedEventType.
 */
export const stopTypeToEventType = (type: SuggestedStop['type']): TimedEventType => {
  switch (type) {
    case 'fuel': return 'fuel';
    case 'meal': return 'meal';
    case 'rest': return 'rest';
    case 'overnight': return 'overnight';
    default: return 'rest';
  }
};

// ─── Stop classification ──────────────────────────────────────────────────────

export interface ClassifyStopsResult {
  boundaryBefore: SuggestedStop[];
  midDrive: SuggestedStop[];
  boundaryAfter: SuggestedStop[];
}

interface ClassifyParams {
  suggestions: SuggestedStop[];
  emittedIds: Set<string>;
  driveStartTime: Date;
  driveEndTime: Date;
  useDayFiltering: boolean;
  currentDayNumber: number;
  /** Current loop index — used for afterSegmentIndex comparison in legacy mode. */
  i: number;
  /** Length of the iteration segment array — used to detect last-segment-of-day. */
  iterSegmentsLength: number;
  /** True when this is the last sub-segment before a day boundary (or the final segment). */
  isLastDaySegment: boolean;
}

/**
 * Partition suggestions into three ordered buckets for a single segment iteration.
 *
 * Two modes:
 *   Day-filtering (useDayFiltering=true): filter by dayNumber, classify by time window.
 *     Stops whose estimatedTime falls after this sub-segment's window are
 *     deferred to a later sub-segment (same day). On the last sub-segment of the day,
 *     all remaining stops are accepted so none are orphaned.
 *
 *   Legacy (useDayFiltering=false): classify by afterSegmentIndex + time window.
 *     Used for simple day trips without tripDays population.
 *
 * The sort on midDrive (by estimatedTime) is applied before returning.
 */
export function classifyStops({
  suggestions,
  emittedIds,
  driveStartTime,
  driveEndTime,
  useDayFiltering,
  currentDayNumber,
  i,
  iterSegmentsLength,
  isLastDaySegment,
}: ClassifyParams): ClassifyStopsResult {
  const boundaryBefore: SuggestedStop[] = [];
  const midDrive: SuggestedStop[] = [];
  const boundaryAfter: SuggestedStop[] = [];

  for (const s of suggestions) {
    if (s.dismissed || emittedIds.has(s.id)) continue;

    // Check if this stop belongs to the current segment's time window
    const hasMidDriveTime = s.estimatedTime &&
      s.estimatedTime.getTime() > driveStartTime.getTime() + 60_000 &&
      s.estimatedTime.getTime() < driveEndTime.getTime() - 60_000;

    if (useDayFiltering) {
      // Day-based filtering: only consider stops for the current day.
      if (s.dayNumber !== undefined && s.dayNumber !== currentDayNumber) continue;

      // Defer stops whose time falls after this sub-segment's window to a
      // later sub-segment in the same day. On the last sub-segment of the day,
      // accept everything remaining so no stops are orphaned.
      const isAfterThisSegment = s.estimatedTime &&
        s.estimatedTime.getTime() > driveEndTime.getTime() + 60_000;
      if (isAfterThisSegment && !isLastDaySegment) continue;

      // Overnight is always boundary-after (end of day). Everything else
      // with a valid mid-drive time is mid-drive.
      if (s.type !== 'overnight' && hasMidDriveTime) {
        midDrive.push(s);
      } else {
        boundaryAfter.push(s);
      }
    } else {
      // Original afterSegmentIndex-based classification (simple day trips)
      const isMidDriveForThisSegment =
        (s.type === 'fuel' || s.type === 'rest' || s.type === 'meal') &&
        Math.floor(s.afterSegmentIndex) === i - 1;

      if (hasMidDriveTime || isMidDriveForThisSegment) {
        midDrive.push(s);
        continue;
      }

      const flooredIdx = Math.floor(s.afterSegmentIndex);
      if (flooredIdx === i - 1) {
        boundaryBefore.push(s);
      } else if (flooredIdx === i) {
        const isEnRouteFuel = /^fuel-enroute-/.test(s.id);
        if (isEnRouteFuel && i + 1 < iterSegmentsLength) {
          // Deferred to next segment's midDrive classification
        } else {
          boundaryAfter.push(s);
        }
      }
    }
  }

  // Sort mid-drive by estimated time
  midDrive.sort((a, b) => (a.estimatedTime?.getTime() ?? 0) - (b.estimatedTime?.getTime() ?? 0));

  return { boundaryBefore, midDrive, boundaryAfter };
}

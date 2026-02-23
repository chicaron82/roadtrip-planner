import type { SuggestionStopType, SuggestedStop } from '../stop-suggestion-types';
import { TRIP_CONSTANTS } from '../trip-constants';

/**
 * Merge priority tiers: higher wins when stops collide.
 * overnight > fuel > meal > rest
 * POI/attraction (future) would slot in below rest.
 */
export const STOP_MERGE_PRIORITY: Record<SuggestionStopType, number> = {
  ...TRIP_CONSTANTS.stops.priorities,
};

/**
 * Consolidate stops that fall within a 60-minute time window of each other.
 * Uses an accumulator pattern so 3+ stops at the same location all merge
 * (the old pair-skip approach left the third stop un-merged).
 *
 * Merge strategy:
 * - Compare each stop against the running accumulator
 * - Winning type = highest priority tier
 * - Duration = max of all merged (long enough for everything)
 * - Priority = most urgent of all merged
 * - Reason = all reasons concatenated
 */
export function consolidateStops(stops: SuggestedStop[]): SuggestedStop[] {
  if (stops.length <= 1) return stops;

  const MERGE_WINDOW_MS = TRIP_CONSTANTS.stops.mergeWindowMs;

  const consolidated: SuggestedStop[] = [];
  let acc = stops[0]; // Running accumulator

  for (let i = 1; i < stops.length; i++) {
    const next = stops[i];
    const timeDeltaMs = Math.abs(next.estimatedTime.getTime() - acc.estimatedTime.getTime());

    if (timeDeltaMs <= MERGE_WINDOW_MS) {
      // Merge next into accumulator
      const accPri  = STOP_MERGE_PRIORITY[acc.type] ?? 0;
      const nextPri = STOP_MERGE_PRIORITY[next.type] ?? 0;
      const winnerIsAcc = accPri >= nextPri;
      const winningType = winnerIsAcc ? acc.type : next.type;

      // Use the winning type's reason as the primary text.
      // The losing type's context becomes a secondary note.
      const primaryReason = winnerIsAcc ? acc.reason : next.reason;
      const secondaryReason = winnerIsAcc ? next.reason : acc.reason;
      // Extract short label from the merged stop (e.g. "Lunch break" from a meal)
      const secondaryLabel = !winnerIsAcc ? acc.type : next.type;
      const secondaryNote = `Also includes ${secondaryLabel} stop: ${secondaryReason}`;

      acc = {
        ...acc,
        id: `merged-${acc.id}-${next.id}`,
        type: winningType,
        reason: `${primaryReason}\n${secondaryNote}`,
        duration: Math.max(acc.duration, next.duration),
        priority:
          acc.priority === 'required' || next.priority === 'required' ? 'required' :
          acc.priority === 'recommended' || next.priority === 'recommended' ? 'recommended' : 'optional',
        details: { ...acc.details, ...next.details },
        dayNumber: acc.dayNumber,
      };
    } else {
      // No merge — push accumulator and start fresh
      consolidated.push(acc);
      acc = next;
    }
  }

  // Don't forget the last accumulator
  consolidated.push(acc);

  return consolidated;
}

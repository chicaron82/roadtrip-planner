import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { TripSummary, TripDay, DayType, OvernightStop } from '../../types';

interface UseDayEditorsOptions {
  /** Live ref to the current summary (avoids stale closures across calculations). */
  summaryRef: RefObject<TripSummary | null>;
  /** Commits a new summary to both the ref and context. */
  commitSummary: (next: TripSummary | null) => void;
}

interface UseDayEditorsReturn {
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: OvernightStop) => void;
}

/**
 * Single-day field editors for a calculated trip. Each patches one day in
 * summary.days and commits — extracted from useTripCalculation to keep that
 * hook under the line cap. Pure presentation-state edits; no OSRM recalc.
 */
export function useDayEditors({ summaryRef, commitSummary }: UseDayEditorsOptions): UseDayEditorsReturn {
  // Generic day updater — updates a single day in summary.days
  const updateDay = useCallback(
    (dayNumber: number, patch: Partial<TripDay>) => {
      const currentSummary = summaryRef.current;
      if (!currentSummary?.days) return;

      const updatedDays = currentSummary.days.map(day =>
        day.dayNumber === dayNumber ? { ...day, ...patch } : day
      );

      commitSummary({ ...currentSummary, days: updatedDays });
    },
    [summaryRef, commitSummary]
  );

  const updateDayNotes = useCallback(
    (dayNumber: number, notes: string) => updateDay(dayNumber, { notes }),
    [updateDay]
  );

  const updateDayTitle = useCallback(
    (dayNumber: number, title: string) => updateDay(dayNumber, { title }),
    [updateDay]
  );

  const updateDayType = useCallback(
    (dayNumber: number, dayType: DayType) => updateDay(dayNumber, { dayType }),
    [updateDay]
  );

  const updateDayOvernight = useCallback(
    (dayNumber: number, overnight: OvernightStop) => updateDay(dayNumber, { overnight }),
    [updateDay]
  );

  return { updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight };
}

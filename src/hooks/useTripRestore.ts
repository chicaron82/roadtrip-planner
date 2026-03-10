/**
 * useTripRestore.ts — Restore a past trip from a history snapshot.
 *
 * Current problem: onLoadHistoryTrip calls setSummary directly, which injects
 * a summary fragment without rebuilding locations, settings, or triggering
 * recalculation. The app shows summary data without the rest of the calculation
 * ecosystem (strategy state, journal coupling, etc.).
 *
 * This hook implements Option B (full restore) from the cook-order plan:
 *   - Rebuilds the location list from segment data stored in the summary
 *   - Recalculates the trip so canonical timeline, fuel stops, and POIs
 *     are all freshly computed from the restored route
 *   - Navigates to Step 1 → triggers calculate → lands on Step 3 with
 *     a live computation, not a stale summary fragment
 *
 * Design note: since fullGeometry is stripped before storage, we must
 * recalculate rather than hydrate. This is the honest path.
 *
 * 💚 My Experience Engine
 */

import { useCallback } from 'react';
import type { HistoryTripSnapshot, Location } from '../types';

interface UseTripRestoreOptions {
  setLocations: (locations: Location[]) => void;
  calculateAndDiscover: () => Promise<void>;
  forceStep: (step: 1 | 2 | 3) => void;
  markStepComplete: (step: number) => void;
}

interface UseTripRestoreReturn {
  restoreHistoryTripSession: (snapshot: HistoryTripSnapshot) => Promise<void>;
  restoreTripSession: (snapshot: HistoryTripSnapshot) => Promise<void>;
}

export function useTripRestore({
  setLocations,
  calculateAndDiscover,
  forceStep,
  markStepComplete,
}: UseTripRestoreOptions): UseTripRestoreReturn {
  const restoreHistoryTripSession = useCallback(async (snapshot: HistoryTripSnapshot): Promise<void> => {
    const locations = snapshot.locations;
    if (!locations || locations.length < 2) {
      console.warn('[restoreTripSession] valid locations missing from snapshot', snapshot);
      return;
    }

    setLocations(locations);

    // Step to 1 while locations settle, then mark steps complete and recalculate
    forceStep(1);
    markStepComplete(1);
    markStepComplete(2);

    // Let the location state flush before kicking off calculation
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await calculateAndDiscover();
  }, [setLocations, calculateAndDiscover, forceStep, markStepComplete]);

  return {
    restoreHistoryTripSession,
    restoreTripSession: restoreHistoryTripSession,
  };
}

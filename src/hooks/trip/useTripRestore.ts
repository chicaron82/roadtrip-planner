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

import { useCallback, useEffect, useRef } from 'react';
import type { HistoryTripSnapshot, Location, TripSettings, TripMode } from '../../types';
import { loadActiveSession } from '../../lib/storage';

interface UseTripRestoreOptions {
  setLocations: (locations: Location[]) => void;
  setSettings: (settings: TripSettings) => void;
  setTripConfirmed: (value: boolean) => void;
  setTripMode: (mode: TripMode | null) => void;
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
  setSettings,
  setTripConfirmed,
  setTripMode,
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

  // ── Active session restore (survives background tab refresh on mobile) ──
  // Runs once on mount. If a saved session exists, restores locations + settings
  // and recalculates the trip so the ghost car and journal resume automatically.
  const sessionRestored = useRef(false);
  const calculateRef = useRef(calculateAndDiscover);
  calculateRef.current = calculateAndDiscover;

  useEffect(() => {
    if (sessionRestored.current) return;
    sessionRestored.current = true;

    const saved = loadActiveSession();
    if (!saved) return;

    setLocations(saved.locations);
    setSettings(saved.settings);
    setTripMode('plan');
    forceStep(1);
    markStepComplete(1);
    markStepComplete(2);

    setTimeout(async () => {
      await calculateRef.current();
      setTripConfirmed(true);
    }, 0);
  // Intentional: one-shot mount effect. All setters are stable Zustand/useState refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    restoreHistoryTripSession,
    restoreTripSession: restoreHistoryTripSession,
  };
}

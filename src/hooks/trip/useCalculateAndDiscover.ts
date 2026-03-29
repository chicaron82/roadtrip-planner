import { useRef, useCallback, useLayoutEffect } from 'react';
import { recordTrip } from '../../lib/user-profile';
import type { TripSettings, TripSummary } from '../../types';
import type { AdaptiveDefaults } from '../../lib/user-profile';

interface UseCalculateAndDiscoverOptions {
  calculateTrip: () => Promise<TripSummary | null>;
  settings: TripSettings;
  setTripConfirmed: (v: boolean) => void;
  refreshAdaptiveDefaults: () => AdaptiveDefaults | null;
  setAdaptiveDefaults: (defaults: AdaptiveDefaults | null) => void;
  /** Called to wipe the stale journal so a fresh one is created for the new route. */
  clearJournal: () => void;
}

/**
 * Orchestrates the "calculate route + discover POIs" two-step.
 * Owns the settingsRef stale-closure guard so App.tsx doesn't have to.
 */
export function useCalculateAndDiscover({
  calculateTrip, settings, setTripConfirmed,
  refreshAdaptiveDefaults, setAdaptiveDefaults,
  clearJournal,
}: UseCalculateAndDiscoverOptions) {
  const settingsRef = useRef(settings);
  useLayoutEffect(() => { settingsRef.current = settings; });

  const calculateAndDiscover = useCallback(async () => {
    setTripConfirmed(false);
    // Wipe the stale journal so App.tsx's auto-start effect can create a fresh
    // one for the new route. Without this, the old journal persists in activeJournal
    // and the `if (activeJournal) return` guard blocks the new journal from being created.
    clearJournal();
    const tripResult = await calculateTrip();
    if (!tripResult) return;
    recordTrip(settingsRef.current);
    setAdaptiveDefaults(refreshAdaptiveDefaults());
  }, [calculateTrip, refreshAdaptiveDefaults, setAdaptiveDefaults, setTripConfirmed, clearJournal]);

  return { calculateAndDiscover };
}

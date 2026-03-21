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
}

/**
 * Orchestrates the "calculate route + discover POIs" two-step.
 * Owns the settingsRef stale-closure guard so App.tsx doesn't have to.
 */
export function useCalculateAndDiscover({
  calculateTrip, settings, setTripConfirmed,
  refreshAdaptiveDefaults, setAdaptiveDefaults,
}: UseCalculateAndDiscoverOptions) {
  const settingsRef = useRef(settings);
  useLayoutEffect(() => { settingsRef.current = settings; });

  const calculateAndDiscover = useCallback(async () => {
    setTripConfirmed(false);
    const tripResult = await calculateTrip();
    if (!tripResult) return;
    recordTrip(settingsRef.current);
    setAdaptiveDefaults(refreshAdaptiveDefaults());
  }, [calculateTrip, refreshAdaptiveDefaults, setAdaptiveDefaults, setTripConfirmed]);

  return { calculateAndDiscover };
}

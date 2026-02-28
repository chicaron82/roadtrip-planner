import { useCallback } from 'react';
import type React from 'react';
import { DEFAULT_LOCATIONS } from '../contexts';
import { getLastOrigin } from '../lib/storage';
import type { Location, TripMode, TripChallenge, TripOrigin } from '../types';

interface UseAppResetOptions {
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setSummary: (s: null) => void;
  resetPOIs: () => void;
  resetWizard: () => void;
  clearStops: () => void;
  clearTripCalculation: () => void;
  setActiveChallenge: (c: TripChallenge | null) => void;
  setTripOrigin: (o: TripOrigin | null) => void;
  setTripConfirmed: (v: boolean) => void;
  setTripMode: (m: TripMode | null) => void;
  setShowAdventureMode: (v: boolean) => void;
}

interface UseAppResetReturn {
  resetTrip: () => void;
  handleSelectMode: (mode: TripMode) => void;
}

/**
 * Coordinates the full trip reset sequence and mode selection entry point.
 * Extracted from App.tsx because both functions fan out to 5+ hooks — per the
 * wiring decision tree, that makes them controllers, not inline callbacks.
 */
export function useAppReset({
  setLocations,
  setSummary,
  resetPOIs,
  resetWizard,
  clearStops,
  clearTripCalculation,
  setActiveChallenge,
  setTripOrigin,
  setTripConfirmed,
  setTripMode,
  setShowAdventureMode,
}: UseAppResetOptions): UseAppResetReturn {
  const resetTrip = useCallback(() => {
    setLocations(DEFAULT_LOCATIONS);
    setSummary(null);
    resetPOIs();
    resetWizard();
    clearStops();
    clearTripCalculation();
    setActiveChallenge(null);
    setTripOrigin(null);
    setTripConfirmed(false);
  }, [setLocations, setSummary, resetPOIs, resetWizard, clearStops, clearTripCalculation, setActiveChallenge, setTripOrigin, setTripConfirmed]);

  const handleSelectMode = useCallback((mode: TripMode) => {
    resetTrip();
    window.history.replaceState({}, '', window.location.pathname);
    resetWizard();
    setTripMode(mode);
    if (mode === 'adventure') setShowAdventureMode(true);
    const lastOrigin = getLastOrigin();
    if (lastOrigin) {
      setLocations(prev =>
        prev.map((loc, i) => i === 0 ? { ...lastOrigin, id: loc.id, type: 'origin' } : loc)
      );
    }
  }, [resetTrip, resetWizard, setTripMode, setShowAdventureMode, setLocations]);

  return { resetTrip, handleSelectMode };
}

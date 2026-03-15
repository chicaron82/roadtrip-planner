import { useCallback } from 'react';
import type React from 'react';
import { getLastOrigin } from '../lib/storage';
import { applyLastOriginToTripInputs } from '../lib/boot-sequence';
import { resetAppAndSelectTripMode, resetTripSession as runResetTripSession } from '../lib/reset-semantics';
import type { Location, TripMode, TripChallenge, TripOrigin } from '../types';

interface UseAppResetOptions {
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  resetPOIs: () => void;
  resetWizard: () => void;
  clearStops: () => void;
  clearTripCalculation: () => void;
  setActiveChallenge: (c: TripChallenge | null) => void;
  setTripOrigin: (o: TripOrigin | null) => void;
  setTripConfirmed: (v: boolean) => void;
  setTripMode: (m: TripMode | null) => void;
  setShowAdventureMode: (v: boolean) => void;
  clearJournal?: () => void;
}

interface UseAppResetReturn {
  resetTripSession: () => void;
  selectTripMode: (mode: TripMode) => void;
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
  resetPOIs,
  resetWizard,
  clearStops,
  clearTripCalculation,
  setActiveChallenge,
  setTripOrigin,
  setTripConfirmed,
  setTripMode,
  setShowAdventureMode,
  clearJournal,
}: UseAppResetOptions): UseAppResetReturn {
  /**
   * Canonical trip reset — the single authoritative reset path for the app.
   *
   * Intentionally PRESERVES (user preferences that survive between trips):
   *   - vehicle            (keep last-used vehicle selection)
   *   - settings           (keep units, currency, gas price, traveler count, etc.)
   *
   * Clears all trip-specific calculated and interaction state:
   *   - locations → DEFAULT_LOCATIONS
   *   - summary, canonicalTimeline, strategicFuelStops (via clearTripCalculation)
   *   - route strategies + share URL (via clearTripCalculation)
   *   - POI state (via resetPOIs)
   *   - wizard step state (via resetWizard)
   *   - user-added map stops (via clearStops)
   *   - active challenge, trip origin, trip confirmed flag
   */
  const resetTripSession = useCallback(() => {
    runResetTripSession({
      setLocations,
      clearTripCalculation,
      resetPOIs,
      clearStops,
      resetWizard,
      setActiveChallenge,
      setTripOrigin,
      setTripConfirmed,
      clearJournal,
    });
  }, [setLocations, clearTripCalculation, resetPOIs, clearStops, resetWizard, setActiveChallenge, setTripOrigin, setTripConfirmed, clearJournal]);

  const selectTripMode = useCallback((mode: TripMode) => {
    resetAppAndSelectTripMode({
      mode,
      resetTripSession,
      clearSharedUrlState: () => window.history.replaceState({}, '', window.location.pathname),
      setTripMode,
      setShowAdventureMode,
      applyLastOrigin: () => applyLastOriginToTripInputs(setLocations, getLastOrigin()),
    });
  }, [resetTripSession, setTripMode, setShowAdventureMode, setLocations]);

  return {
    resetTripSession,
    selectTripMode,
    resetTrip: resetTripSession,
    handleSelectMode: selectTripMode,
  };
}

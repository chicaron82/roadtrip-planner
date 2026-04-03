import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getHistory, saveActiveSession, loadActiveSession, getLastOrigin } from '../../lib/storage';
import { applyLastOriginToTripInputs } from '../../lib/boot-sequence';
import { resetAppAndSelectTripMode, resetTripSession as runResetTripSession } from '../../lib/reset-semantics';
import type { Location, TripMode, TripChallenge, TripOrigin, TripSettings, HistoryTripSnapshot } from '../../types';

interface UseSessionLifecycleOptions {
  locations: Location[];
  settings: TripSettings;
  tripConfirmed: boolean;
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  setTripConfirmed: (value: boolean) => void;
  setTripMode: (m: TripMode | null) => void;
  setShowAdventureMode: (v: boolean) => void;
  setActiveChallenge: (c: TripChallenge | null) => void;
  setTripOrigin: (o: TripOrigin | null) => void;
  resetPOIs: () => void;
  resetWizard: () => void;
  clearStops: () => void;
  clearTripCalculation: () => void;
  clearJournal?: () => void;
  setCustomTitle?: (title: string | null) => void;
  calculateAndDiscover: () => Promise<void>;
  forceStep: (step: 1 | 2 | 3) => void;
  markStepComplete: (step: number) => void;
}

export function useSessionLifecycle({
  locations,
  settings,
  tripConfirmed,
  setLocations,
  setSettings,
  setTripConfirmed,
  setTripMode,
  setShowAdventureMode,
  setActiveChallenge,
  setTripOrigin,
  resetPOIs,
  resetWizard,
  clearStops,
  clearTripCalculation,
  clearJournal,
  setCustomTitle,
  calculateAndDiscover,
  forceStep,
  markStepComplete,
}: UseSessionLifecycleOptions) {
  // ── 1. History state ───────────────────────────────────────────────────────
  const [history] = useState<HistoryTripSnapshot[]>(() => getHistory());

  // ── 2. Active Session Autosave ────────────────────────────────────────────
  useEffect(() => {
    if (!tripConfirmed || !locations.some(l => l.lat !== 0)) return;
    saveActiveSession(locations, settings);
  }, [tripConfirmed, locations, settings]);

  const hasActiveSession = locations.some(loc => loc.name && loc.name.trim() !== '');
  const lastDestination = (() => {
    const locs = history[0]?.locations;
    return locs && locs.length > 0 ? locs[locs.length - 1].name : undefined;
  })();

  // ── 3. Active Session Restore ──────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 4. History Restore ─────────────────────────────────────────────────────
  const restoreHistoryTripSession = useCallback(async (snapshot: HistoryTripSnapshot): Promise<void> => {
    const snaps = snapshot.locations;
    if (!snaps || snaps.length < 2) {
      console.warn('[restoreTripSession] valid locations missing from snapshot', snapshot);
      return;
    }

    setLocations(snaps);
    forceStep(1);
    markStepComplete(1);
    markStepComplete(2);

    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await calculateAndDiscover();
  }, [setLocations, calculateAndDiscover, forceStep, markStepComplete]);

  // ── 5. App Reset (Canonical) ───────────────────────────────────────────────
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
      setCustomTitle,
    });
  }, [setLocations, clearTripCalculation, resetPOIs, clearStops, resetWizard, setActiveChallenge, setTripOrigin, setTripConfirmed, clearJournal, setCustomTitle]);

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
    history,
    hasActiveSession,
    lastDestination,
    resetTripSession,
    selectTripMode,
    restoreHistoryTripSession,
  };
}

/**
 * useIcebreakerGate — Manages the icebreaker flow between landing and wizard.
 *
 * Intercepts mode selection from the landing screen and routes through
 * the icebreaker if the user's entry preference calls for it.
 * On completion, pre-fills trip state before handing off to the wizard.
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback } from 'react';
import type { Location, TripMode, TripSettings } from '../types';
import { getEntryPreference, saveEntryPreference } from '../lib/storage';
import type { IcebreakerPrefill } from '../components/Icebreaker/IcebreakerGate';

interface UseIcebreakerGateOptions {
  selectTripMode: (mode: TripMode) => void;
  setLocations: (locations: Location[]) => void;
  setSettings: (updater: (prev: TripSettings) => TripSettings) => void;
  markStepComplete: (step: number) => void;
  forceStep: (step: 1 | 2 | 3) => void;
}

export function useIcebreakerGate({
  selectTripMode,
  setLocations,
  setSettings,
  markStepComplete,
  forceStep,
}: UseIcebreakerGateOptions) {
  const [icebreakerMode, setIcebreakerMode] = useState<TripMode | null>(null);

  /** Called by LandingScreen when user taps a mode card. */
  const handleLandingSelect = useCallback((mode: TripMode) => {
    const pref = getEntryPreference();
    if (pref === 'classic') {
      selectTripMode(mode);
    } else {
      // null (first-timer) or 'conversational' → show icebreaker
      setIcebreakerMode(mode);
    }
  }, [selectTripMode]);

  /** Called when the icebreaker completes — apply prefill then open wizard at Step 2. */
  const handleIcebreakerComplete = useCallback((mode: TripMode, prefill: IcebreakerPrefill) => {
    if (prefill.locations && prefill.locations.length >= 2) {
      setLocations(prefill.locations as Location[]);
    }
    if (prefill.settingsPartial) {
      const partial = prefill.settingsPartial;
      setSettings(prev => ({ ...prev, ...partial }));
    }
    markStepComplete(1);
    forceStep(2);
    setIcebreakerMode(null);
    selectTripMode(mode);
  }, [selectTripMode, setLocations, setSettings, markStepComplete, forceStep]);

  /** Called when user hits escape hatch — optionally saves classic preference. */
  const handleIcebreakerEscape = useCallback((mode: TripMode, saveAsClassic = false) => {
    if (saveAsClassic) saveEntryPreference('classic');
    setIcebreakerMode(null);
    selectTripMode(mode);
  }, [selectTripMode]);

  return {
    icebreakerMode,
    handleLandingSelect,
    handleIcebreakerComplete,
    handleIcebreakerEscape,
  };
}

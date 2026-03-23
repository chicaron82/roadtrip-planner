/**
 * useIcebreakerGate — Manages the icebreaker flow between landing and wizard.
 *
 * Intercepts mode selection from the landing screen and routes through
 * the icebreaker if the user's entry preference calls for it.
 * On completion, pre-fills trip state before handing off to the wizard.
 *
 * IMPORTANT: On completion we use setTripMode directly (not selectTripMode).
 * selectTripMode resets everything first — that would wipe the icebreaker prefill.
 * selectTripMode is reserved for the escape path, where it resets the session.
 * When prefillLocations are provided on escape, they are re-applied after the reset.
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback } from 'react';
import type { Location, TripMode, TripSettings, Vehicle } from '../../types';
import { getEntryPreference, saveEntryPreference } from '../../lib/storage';
import type { IcebreakerPrefill } from '../../components/Icebreaker/IcebreakerGate';
import type { AdventureInitialValues } from '../ui/useAdventureModeController';

interface UseIcebreakerGateOptions {
  selectTripMode: (mode: TripMode) => void;
  setTripMode: (mode: TripMode) => void;
  setShowAdventureMode: (v: boolean) => void;
  setLocations: (locations: Location[]) => void;
  setVehicle: (vehicle: Vehicle) => void;
  setSettings: (updater: (prev: TripSettings) => TripSettings) => void;
  markStepComplete: (step: number) => void;
  forceStep: (step: 1 | 2 | 3) => void;
  /** When set, plan-mode icebreaker flows through the Four-Beat Arc instead of opening the wizard directly. */
  onFourBeatArc?: (prefill: IcebreakerPrefill) => void;
}

export function useIcebreakerGate({
  selectTripMode,
  setTripMode,
  setShowAdventureMode,
  setLocations,
  setVehicle,
  setSettings,
  markStepComplete,
  forceStep,
  onFourBeatArc,
}: UseIcebreakerGateOptions) {
  const [icebreakerMode, setIcebreakerMode] = useState<TripMode | null>(null);
  const [adventureInitialValues, setAdventureInitialValues] = useState<AdventureInitialValues | null>(null);
  const [estimateWorkshopActive, setEstimateWorkshopActive] = useState(false);

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

  /** Called when the icebreaker completes — apply prefill then open wizard. */
  const handleIcebreakerComplete = useCallback((mode: TripMode, prefill: IcebreakerPrefill) => {
    // Apply location prefill
    if (prefill.locations && prefill.locations.length >= 1) {
      setLocations(prefill.locations as Location[]);
    }

    // Apply settings prefill
    if (prefill.settingsPartial) {
      const partial = prefill.settingsPartial;
      setSettings(prev => ({ ...prev, ...partial }));
    }

    // Apply vehicle prefill (estimate mode)
    if (prefill.vehiclePrefill) {
      setVehicle(prefill.vehiclePrefill);
    }

    setIcebreakerMode(null);

    if (mode === 'adventure') {
      // Store adventure initial values for AdventureMode to read
      if (prefill.adventurePrefill) {
        setAdventureInitialValues(prefill.adventurePrefill);
      }
      // Activate without reset — origin is already set in locations
      setTripMode('adventure');
      setShowAdventureMode(true);
    } else if (mode === 'estimate') {
      // Show the Estimate Workshop before opening the wizard.
      // calculateAndDiscover fires in a useEffect in App.tsx watching estimateWorkshopActive
      // (after React commits state) so it reads the correct icebreaker locations/vehicle.
      setEstimateWorkshopActive(true);
    } else if (onFourBeatArc) {
      // Plan → Four-Beat Arc (prefill already applied above)
      onFourBeatArc(prefill);
    } else {
      // Plan → open wizard at Step 2 (classic)
      markStepComplete(1);
      forceStep(2);
      setTripMode('plan');
    }
  }, [setTripMode, setShowAdventureMode, setLocations, setVehicle, setSettings, markStepComplete, forceStep, onFourBeatArc]);

  /** Called when user hits escape hatch — optionally saves classic preference.
   *  Pass prefillLocations to carry entered origin/destination into the classic wizard. */
  const handleIcebreakerEscape = useCallback((mode: TripMode, saveAsClassic = false, prefillLocations?: Location[]) => {
    if (saveAsClassic) saveEntryPreference('classic');
    setIcebreakerMode(null);
    // Escape = full reset + mode select (same as classic flow).
    selectTripMode(mode === 'estimate' ? 'plan' : mode);
    // Re-apply any locations the user entered before the reset wiped them.
    if (prefillLocations && prefillLocations.some(l => l.name?.trim())) {
      setLocations(prefillLocations);
    }
  }, [selectTripMode, setLocations]);

  /** Estimate Workshop: user commits — apply any setting overrides then open wizard. */
  const handleEstimateWorkshopCommit = useCallback((settingsOverride: Partial<TripSettings>) => {
    setSettings(prev => ({ ...prev, ...settingsOverride }));
    setEstimateWorkshopActive(false);
    markStepComplete(1);
    markStepComplete(2); // vehicle was set during icebreaker
    forceStep(2);
    setTripMode('plan');
  }, [setSettings, setTripMode, markStepComplete, forceStep]);

  /** Estimate Workshop: user skips — open wizard directly with what's already set. */
  const handleEstimateWorkshopEscape = useCallback(() => {
    setEstimateWorkshopActive(false);
    markStepComplete(1);
    forceStep(2);
    setTripMode('plan');
  }, [setTripMode, markStepComplete, forceStep]);

  return {
    icebreakerMode,
    estimateWorkshopActive,
    adventureInitialValues,
    handleLandingSelect,
    handleIcebreakerComplete,
    handleIcebreakerEscape,
    handleEstimateWorkshopCommit,
    handleEstimateWorkshopEscape,
  };
}

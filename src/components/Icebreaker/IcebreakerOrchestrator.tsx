/**
 * IcebreakerOrchestrator — Manager layer for all icebreaker flows.
 *
 * Owns: useFourBeatArc, useIcebreakerGate, arc completion logic,
 * estimate workshop trigger, and the six overlay components.
 *
 * App.tsx delegates the entire icebreaker domain here. In return,
 * the orchestrator exposes:
 *   - handleLandingSelect (LandingScreen's onSelectMode)
 *   - adventureInitialValues (AdventureMode's initial state)
 *   - arcActive (true when any icebreaker overlay is showing)
 *   - onCalcComplete() (arc intercept for onCalcCompleteRef)
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type { Vehicle, TripSettings, TripSummary, TripMode, Location } from '../../types';
import type { AdventureInitialValues } from '../../hooks';
import { useFourBeatArc } from '../../hooks';
import { useIcebreakerGate } from '../../hooks';
import { buildSeededTitle } from '../../lib/trip-title-seeds';
import type { IcebreakerOverlayProps } from './IcebreakerOverlays';

// ── Props (what App.tsx passes in) ───────────────────────────────────────────

interface IcebreakerOrchestratorProps {
  // TripCore
  locations: Location[];
  setLocations: (locations: Location[] | ((prev: Location[]) => Location[])) => void;
  vehicle: Vehicle;
  setVehicle: (v: Vehicle) => void;
  settings: TripSettings;
  setSettings: (updater: (prev: TripSettings) => TripSettings) => void;
  setIcebreakerOrigin: (v: boolean) => void;

  // Wizard
  markStepComplete: (step: number) => void;
  forceStep: (step: 1 | 2 | 3) => void;

  // Mode
  tripMode: TripMode | null;
  setTripMode: (mode: TripMode) => void;
  selectTripMode: (mode: TripMode) => void;
  setShowAdventureMode: (v: boolean) => void;

  // Calculation
  calculateAndDiscover: () => void;
  isCalculating: boolean;
  summary: TripSummary | null;
  calculationMessage: string | null;
  calcError: string | null;

  // Adventure preview (map circle)
  setAdventurePreview: (v: { lat: number; lng: number; radiusKm: number } | null) => void;
  /** Called when the arc bloom completes — mounts VoilaScreen universally. */
  onShowVoila: () => void;
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
  /** Trigger the cinematic map flyover before starting the Voila reveal */
  onTriggerFlyover: () => void;
}

// ── Return (what App.tsx reads) ──────────────────────────────────────────────

export interface IcebreakerOrchestratorState {
  handleLandingSelect: (mode: TripMode) => void;
  adventureInitialValues: AdventureInitialValues | null;
  /** True when any icebreaker overlay is active (gate, workshop, or arc beat). */
  arcActive: boolean;
  /** Arc intercept for onCalcCompleteRef. Returns true if arc handled it. */
  onCalcComplete: () => boolean;
  /** Android back button handler — navigates within the arc/icebreaker instead of exiting. */
  handleBack: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIcebreakerOrchestrator(
  props: IcebreakerOrchestratorProps,
): IcebreakerOrchestratorState & { overlayProps: IcebreakerOverlayProps } {
  const {
    locations, setLocations, vehicle, setVehicle, settings, setSettings, setIcebreakerOrigin,
    markStepComplete, forceStep,
    tripMode, setTripMode, selectTripMode, setShowAdventureMode,
    calculateAndDiscover, isCalculating, summary, calculationMessage, calcError,
    setAdventurePreview, onShowVoila,
    customTitle, setCustomTitle, onTriggerFlyover,
  } = props;

  const arc = useFourBeatArc();

  // Beat-transition car — tracks previous beat to detect forward advances.
  const prevBeatRef = useRef<typeof arc.beat>(null);
  const [transitionCar, setTransitionCar] = useState<{
    from: 1 | 2 | 3;
    to:   2 | 3 | 4;
  } | null>(null);

  useEffect(() => {
    const prev = prevBeatRef.current;
    const curr = arc.beat;
    if (prev !== null && curr !== null && curr > prev) {
      setTransitionCar({ from: prev as 1 | 2 | 3, to: curr as 2 | 3 | 4 });
    }
    prevBeatRef.current = curr;
  }, [arc.beat]);

  const {
    icebreakerMode, estimateWorkshopActive, adventureInitialValues,
    handleLandingSelect, handleIcebreakerComplete, handleIcebreakerEscape,
    handleEstimateWorkshopCommit, handleEstimateWorkshopEscape,
  } = useIcebreakerGate({
    selectTripMode, setTripMode, setShowAdventureMode, setLocations, setVehicle, setSettings,
    markStepComplete, forceStep,
    onFourBeatArc: (prefill) => {
      const prefillLocations = (prefill.locations ?? locations) as Location[];
      const mergedSettings = prefill.settingsPartial
        ? { ...settings, ...prefill.settingsPartial }
        : settings;
      arc.enterSketch(prefillLocations, vehicle, mergedSettings);
    },
    onEstimateWorkshopCommit: () => {
      // Transition from Workshop overlay to Four-Beat Arc (Beat 4: Building/Voilà)
      arc.startCalculation();
      calculateAndDiscover();
    },
  });

  // Trigger background calculation when Estimate Workshop opens.
  useEffect(() => {
    if (estimateWorkshopActive) calculateAndDiscover();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateWorkshopActive]);

  /** Called when the Four-Beat Arc voilà bloom completes — mounts VoilaScreen. */
  const handleArcComplete = useCallback(() => {
    arc.onRevealComplete();
    setIcebreakerOrigin(true);
    onShowVoila();
  }, [arc, setIcebreakerOrigin, onShowVoila]);

  /** Arc intercept — returns true if the arc handled the calc completion. */
  const onCalcComplete = useCallback((): boolean => {
    if (arc.beat === 4) {
      onTriggerFlyover();
      return true;
    }
    // If the estimate workshop is open, the calculation was triggered just to
    // price the route. Consume the completion event so the app doesn't trigger a flyover.
    if (estimateWorkshopActive) {
      return true;
    }
    return false;
  }, [arc, estimateWorkshopActive]);

  // When calculation fails at beat 4, exit the arc and fall back to the
  // classic wizard so the user can see the error toast and retry. Without
  // setting tripMode the surface falls to 'landing' because tripMode is
  // still null in the icebreaker path (only set on voila lock-in).
  useEffect(() => {
    if (arc.beat === 4 && arc.isBuilding && calcError) {
      arc.exitArc();
      setTripMode('plan');
      markStepComplete(1);
      forceStep(2);
    }
  }, [arc, calcError, setTripMode, markStepComplete, forceStep]);

  /**
   * Android back button handler — navigates within the arc/icebreaker.
   * Priority: arc beats → icebreaker gate → estimate workshop.
   * Beat 4 is no-op (let calculation complete rather than interrupting).
   */
  const handleBack = useCallback(() => {
    if (arc.beat === 3) { arc.returnToSketch(); return; }
    if (arc.beat === 2) { arc.exitArc(); return; }
    if (arc.beat === 4) return; // calculation in flight — don't interrupt
    if (icebreakerMode) { handleIcebreakerEscape(icebreakerMode); return; }
    if (estimateWorkshopActive) { handleEstimateWorkshopEscape(); return; }
  }, [arc, icebreakerMode, estimateWorkshopActive, handleIcebreakerEscape, handleEstimateWorkshopEscape]);

  const arcActive = !!(icebreakerMode || estimateWorkshopActive || arc.beat);

  // Seeded title derived from sketch data — stable for the duration of the workshop session.
  // Computed from the last sketch location as destination + estimated days at balanced pace.
  const seededTitle = arc.sketchData
    ? buildSeededTitle({
        destination: arc.sketchData.destinationName.split(',')[0].trim(),
        days: Math.max(1, Math.ceil(arc.sketchData.distanceKm / 720)),
        travelerCount: settings.numTravelers ?? 1,
      })
    : '';

  const overlayProps: IcebreakerOverlayProps = {
    tripMode,
    arc,
    transitionCar,
    onTransitionCarComplete: useCallback(() => setTransitionCar(null), []),
    icebreakerMode,
    estimateWorkshopActive,
    vehicle,
    settings,
    summary,
    locations,
    isCalculating,
    calculationMessage,
    calculateAndDiscover,
    selectTripMode,
    setVehicle,
    setSettings,
    setAdventurePreview,
    handleArcComplete,
    handleIcebreakerComplete,
    handleIcebreakerEscape,
    handleEstimateWorkshopCommit,
    handleEstimateWorkshopEscape,
    customTitle,
    setCustomTitle,
    seededTitle,
  };

  return {
    handleLandingSelect,
    adventureInitialValues,
    arcActive,
    onCalcComplete,
    handleBack,
    overlayProps,
  };
}

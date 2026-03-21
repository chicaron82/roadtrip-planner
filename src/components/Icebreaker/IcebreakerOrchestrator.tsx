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

import { useEffect, useCallback } from 'react';
import type { Vehicle, TripSettings, TripSummary, TripMode, Location } from '../../types';
import type { AdventureInitialValues } from '../../hooks';
import type { IcebreakerPrefill } from './IcebreakerGate';
import { useFourBeatArc } from '../../hooks';
import { useIcebreakerGate } from '../../hooks';
import { IcebreakerGate } from './IcebreakerGate';
import { EstimateWorkshop } from './EstimateWorkshop';
import { SketchCard } from './SketchCard';
import { VoilaReveal } from './VoilaReveal';
import { UnifiedWorkshopPanel } from '../Workshop/UnifiedWorkshopPanel';
import { buildSeededTitle } from '../../lib/trip-title-seeds';

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

  // Adventure preview (map circle)
  setAdventurePreview: (v: { lat: number; lng: number; radiusKm: number } | null) => void;
  /** Called when the arc bloom completes — mounts VoilaScreen universally. */
  onShowVoila: () => void;
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
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
    calculateAndDiscover, isCalculating, summary, calculationMessage,
    setAdventurePreview, onShowVoila,
    customTitle, setCustomTitle,
  } = props;

  const arc = useFourBeatArc();

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
      arc.onBuildComplete();
      return true;
    }
    return false;
  }, [arc]);

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

// ── Overlay component ────────────────────────────────────────────────────────

interface IcebreakerOverlayProps {
  tripMode: TripMode | null;
  arc: ReturnType<typeof useFourBeatArc>;
  icebreakerMode: TripMode | null;
  estimateWorkshopActive: boolean;
  vehicle: Vehicle;
  settings: TripSettings;
  summary: TripSummary | null;
  locations: Location[];
  isCalculating: boolean;
  calculationMessage: string | null;
  calculateAndDiscover: () => void;
  selectTripMode: (mode: TripMode) => void;
  setVehicle: (v: Vehicle) => void;
  setSettings: (updater: (prev: TripSettings) => TripSettings) => void;
  setAdventurePreview: (v: { lat: number; lng: number; radiusKm: number } | null) => void;
  handleArcComplete: () => void;
  handleIcebreakerComplete: (mode: TripMode, prefill: IcebreakerPrefill) => void;
  handleIcebreakerEscape: (mode: TripMode, saveAsClassic?: boolean) => void;
  handleEstimateWorkshopCommit: (settingsOverride: Partial<TripSettings>) => void;
  handleEstimateWorkshopEscape: () => void;
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
  seededTitle: string;
}

export function IcebreakerOverlays(p: IcebreakerOverlayProps) {
  return (
    <>
      {/* Beat 2 — Sketch Card */}
      {!p.tripMode && p.arc.beat === 2 && p.arc.sketchData && (
        <SketchCard
          sketchData={p.arc.sketchData}
          tripMode="plan"
          onMakePersonal={p.arc.enterWorkshop}
          onCalculateDefaults={() => { p.arc.startCalculation(); p.calculateAndDiscover(); }}
          onAdjustRoute={() => { p.arc.exitArc(); p.selectTripMode('plan'); }}
        />
      )}

      {/* Beat 3 — Unified Workshop Panel */}
      {!p.tripMode && p.arc.beat === 3 && p.arc.sketchData && (
        <UnifiedWorkshopPanel
          sketchDistanceKm={p.arc.sketchData.distanceKm}
          sketchDurationMinutes={Math.round((p.arc.sketchData.distanceKm / 90) * 60)}
          vehicle={p.vehicle}
          settings={p.settings}
          customTitle={p.customTitle}
          seededTitle={p.seededTitle}
          onCommit={(overrides) => {
            if (overrides.vehicle) p.setVehicle(overrides.vehicle);
            if (overrides.settings) p.setSettings(prev => ({ ...prev, ...overrides.settings }));
            p.arc.startCalculation();
            setTimeout(() => p.calculateAndDiscover(), 0);
          }}
          onTitleChange={p.setCustomTitle}
          onEscape={() => { p.arc.exitArc(); p.selectTripMode('plan'); }}
        />
      )}

      {/* Beat 4 — Building state */}
      {!p.tripMode && p.arc.beat === 4 && p.arc.isBuilding && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#f5f0e8', fontSize: 18, fontFamily: '"Cormorant Garamond", Georgia, serif', marginBottom: 12 }}>✦</p>
          <p style={{ color: '#f5f0e8', fontSize: 16, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
            {p.calculationMessage || 'Building your MEE time...'}
          </p>
        </div>
      )}

      {/* Beat 4 — Voilà Reveal */}
      {!p.tripMode && p.arc.beat === 4 && p.arc.isRevealing && p.summary && (
        <VoilaReveal
          summary={p.summary}
          settings={p.settings}
          originName={p.locations.find(l => l.type === 'origin')?.name ?? ''}
          destinationName={p.locations.find(l => l.type === 'destination')?.name ?? ''}
          onComplete={p.handleArcComplete}
        />
      )}

      {/* Estimate Workshop */}
      {!p.tripMode && p.estimateWorkshopActive && (
        <EstimateWorkshop
          summary={p.summary ?? null}
          vehicle={p.vehicle}
          settings={p.settings}
          isCalculating={p.isCalculating}
          onCommit={p.handleEstimateWorkshopCommit}
          onEscape={p.handleEstimateWorkshopEscape}
        />
      )}

      {/* Icebreaker Gate */}
      {!p.tripMode && p.icebreakerMode && !p.estimateWorkshopActive && (
        <IcebreakerGate
          mode={p.icebreakerMode}
          onComplete={(mode, prefill) => { p.setAdventurePreview(null); p.handleIcebreakerComplete(mode, prefill); }}
          onEscape={(mode, saveAsClassic) => { p.setAdventurePreview(null); p.handleIcebreakerEscape(mode, saveAsClassic); }}
          onAdventurePreviewChange={(lat, lng, radiusKm) =>
            p.setAdventurePreview({ lat, lng, radiusKm })
          }
        />
      )}
    </>
  );
}

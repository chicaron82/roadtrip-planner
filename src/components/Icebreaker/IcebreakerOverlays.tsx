/**
 * IcebreakerOverlays — The six overlay components rendered by the Four-Beat Arc.
 *
 * Extracted from IcebreakerOrchestrator.tsx so that file no longer co-exports
 * a hook and a component (which breaks React Fast Refresh).
 *
 * App.tsx mounts: <IcebreakerOverlays {...icebreaker.overlayProps} />
 *
 * 💚 My Experience Engine
 */

import type { Vehicle, TripSettings, TripSummary, TripMode, Location } from '../../types';
import type { IcebreakerPrefill } from './IcebreakerGate';
import type { useFourBeatArc } from '../../hooks';
import { useCallback } from 'react';
import { IcebreakerGate } from './IcebreakerGate';
import { EstimateWorkshop } from './EstimateWorkshop';
import { SketchCard } from './SketchCard';
import { VoilaReveal } from './VoilaReveal';
import { UnifiedWorkshopPanel } from '../Workshop/UnifiedWorkshopPanel';
import { BeatProgressDots } from './BeatProgressDots';
import { BeatTransitionCar } from './BeatTransitionCar';

// ── Props ────────────────────────────────────────────────────────────────────

export interface IcebreakerOverlayProps {
  tripMode: TripMode | null;
  arc: ReturnType<typeof useFourBeatArc>;
  transitionCar: { from: 1 | 2 | 3; to: 2 | 3 | 4 } | null;
  onTransitionCarComplete: () => void;
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
  handleIcebreakerEscape: (mode: TripMode, saveAsClassic?: boolean, prefillLocations?: Location[]) => void;
  handleEstimateWorkshopCommit: (settingsOverride: Partial<TripSettings>) => void;
  handleEstimateWorkshopEscape: () => void;
  customTitle: string | null;
  setCustomTitle: (title: string | null) => void;
  seededTitle: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function IcebreakerOverlays(p: IcebreakerOverlayProps) {
  const handleAdventurePreviewChange = useCallback(
    (lat: number, lng: number, radiusKm: number) => p.setAdventurePreview({ lat, lng, radiusKm }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.setAdventurePreview],
  );

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

      {/* Beat progress dots — visible from Beat 2 onward */}
      {!p.tripMode && p.arc.beat !== null && p.arc.beat > 1 && (
        <BeatProgressDots currentBeat={p.arc.beat as 2 | 3 | 4} />
      )}

      {/* Transition car — briefly appears on each beat advance */}
      {!p.tripMode && p.transitionCar && (
        <BeatTransitionCar
          fromBeat={p.transitionCar.from}
          toBeat={p.transitionCar.to}
          onComplete={p.onTransitionCarComplete}
        />
      )}

      {/* Icebreaker Gate */}
      {!p.tripMode && p.icebreakerMode && !p.estimateWorkshopActive && (
        <IcebreakerGate
          mode={p.icebreakerMode}
          onComplete={(mode, prefill) => { p.setAdventurePreview(null); p.handleIcebreakerComplete(mode, prefill); }}
          onEscape={(mode, saveAsClassic, prefillLocations) => { p.setAdventurePreview(null); p.handleIcebreakerEscape(mode, saveAsClassic, prefillLocations); }}
          onAdventurePreviewChange={handleAdventurePreviewChange}
        />
      )}
    </>
  );
}

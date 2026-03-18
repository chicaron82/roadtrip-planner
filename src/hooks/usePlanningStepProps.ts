import { useCallback } from 'react';
import type React from 'react';
import { PlanningStepContent } from '../components/Steps/PlanningStepContent';
import { useStep3Controller } from './useStep3Controller';
import type { Location, Vehicle, TripSettings, TripSummary, HistoryTripSnapshot, TripMode, TripChallenge, POISuggestion, TripJournal, POI, POICategory, RouteSegment } from '../types';
import type { StylePreset } from '../lib/style-presets';
import type { ViewMode } from './useJournal';
import type { TemplateImportResult } from '../lib/url';
import type { SuggestedStop } from '../lib/stop-suggestions';
import type { PlanningStep } from './useWizard';
import type { StopType } from '../types';
import type { TimedEvent } from '../lib/trip-timeline';

const POI_CATEGORY_MAP: Partial<Record<string, POICategory>> = {
  gas: 'gas', food: 'food', restaurant: 'food', cafe: 'food', hotel: 'hotel', attraction: 'attraction',
};

type PlanningStepContentProps = React.ComponentProps<typeof PlanningStepContent>;

interface UsePlanningStepPropsOptions {
  // Navigation
  planningStep: PlanningStep;
  goToStep: (step: PlanningStep) => void;
  // Context
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  vehicle: Vehicle;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  summary: TripSummary | null;
  tripMode: TripMode;
  // Mode
  setShowAdventureMode: (v: boolean) => void;
  // Trip loader
  handleImportTemplate: (r: TemplateImportResult) => void;
  handleSelectChallenge: (c: TripChallenge) => void;
  activeChallenge: TripChallenge | null;
  // Style preset
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  handlePresetChange: (p: StylePreset) => void;
  handleSharePreset: () => Promise<void>;
  shareJustCopied: boolean;
  // Journal
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  activeJournal: TripJournal | null;
  isJournalComplete: boolean;
  showCompleteOverlay: boolean;
  startJournal: (title?: string) => void;
  updateActiveJournal: (j: TripJournal) => void;
  confirmJournalComplete: () => void;
  // Trip state
  tripConfirmed: boolean;
  setTripConfirmed: (v: boolean) => void;
  history: HistoryTripSnapshot[];
  // Added stops
  addedStopCount: number;
  externalStops: SuggestedStop[];
  // Calculation
  shareUrl: string | null;
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  dismissOvernightPrompt: () => void;
  updateStopType: (idx: number, t: StopType) => void;
  // POI
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults: boolean;
  poiFetchFailed: boolean;
  addPOI: (id: string) => void;
  addStop: (poi: POI, segments: RouteSegment[], explicitSegmentIndex?: number) => void;
  dismissPOI: (id: string) => void;
  // Print
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  // Actions
  openInGoogleMaps: () => void;
  copyShareLink: () => void;
  onLoadHistoryTrip: (trip: HistoryTripSnapshot) => void;
  /** Called when user taps a tune option — applies settings patch and recalculates. */
  onTune?: (patch: Partial<TripSettings>) => void;
}

/**
 * Assembles the full props object for <PlanningStepContent />.
 * Keeps App.tsx from spelling out 30+ props inline — it just calls this
 * hook and spreads the result: <PlanningStepContent {...stepProps} />
 */
export function usePlanningStepProps(o: UsePlanningStepPropsOptions): PlanningStepContentProps {
  const { setShowAdventureMode, setTripConfirmed, setViewMode, addPOI, poiSuggestions, addStop, summary } = o;

  const onShowAdventure = useCallback(() => setShowAdventureMode(true), [setShowAdventureMode]);
  const onConfirmTrip = useCallback(() => setTripConfirmed(true), [setTripConfirmed]);
  const onUnconfirmTrip = useCallback(() => {
    setTripConfirmed(false);
    setViewMode('plan');
  }, [setTripConfirmed, setViewMode]);

  const handleAddPOI = useCallback((poiId: string, segmentIndex?: number) => {
    addPOI(poiId);
    const poi = poiSuggestions.find(p => p.id === poiId);
    if (poi) {
      addStop(
        { id: poi.id, name: poi.name, lat: poi.lat, lng: poi.lng, address: poi.address, category: (POI_CATEGORY_MAP[poi.category] ?? 'attraction') as POICategory },
        summary?.segments ?? [],
        segmentIndex  // undefined = auto-detect nearest; set for leg-picker override
      );
    }
  }, [addPOI, poiSuggestions, addStop, summary]);

  const step3Controller = useStep3Controller({
    summary: o.summary,
    settings: o.settings,
    vehicle: o.vehicle,
    locations: o.locations,
    tripMode: o.tripMode,
    viewMode: o.viewMode,
    setViewMode: o.setViewMode,
    activeJournal: o.activeJournal,
    activeChallenge: o.activeChallenge,
    tripConfirmed: o.tripConfirmed,
    addedStopCount: o.addedStopCount,
    shareUrl: o.shareUrl,
    precomputedEvents: o.precomputedEvents,
    isCalculating: o.isCalculating,
    suggestedOvernightStop: o.suggestedOvernightStop,
    showOvernightPrompt: o.showOvernightPrompt,
    poiSuggestions: o.poiSuggestions,
    poiInference: o.poiInference,
    isLoadingPOIs: o.isLoadingPOIs,
    poiPartialResults: o.poiPartialResults,
    poiFetchFailed: o.poiFetchFailed,
    externalStops: o.externalStops,
    onOpenGoogleMaps: o.openInGoogleMaps,
    onCopyShareLink: o.copyShareLink,
    isJournalComplete: o.isJournalComplete,
    showCompleteOverlay: o.showCompleteOverlay,
    onConfirmJournalComplete: o.confirmJournalComplete,
    onStartJournal: o.startJournal,
    onUpdateJournal: o.updateActiveJournal,
    onUpdateStopType: o.updateStopType,
    onDismissOvernight: o.dismissOvernightPrompt,
    onAddPOI: handleAddPOI,
    onDismissPOI: o.dismissPOI,
    onConfirmTrip,
    onUnconfirmTrip,
  });

  return {
    planningStep: o.planningStep,
    locations: o.locations,
    setLocations: o.setLocations,
    vehicle: o.vehicle,
    setVehicle: o.setVehicle,
    settings: o.settings,
    setSettings: o.setSettings,
    summary: o.summary,
    tripMode: o.tripMode,
    onShowAdventure,
    onImportTemplate: o.handleImportTemplate,
    activePreset: o.activePreset,
    presetOptions: o.presetOptions,
    onPresetChange: o.handlePresetChange,
    onSharePreset: o.handleSharePreset,
    shareJustCopied: o.shareJustCopied,
    step3Props: {
      controller: step3Controller,
      history: o.history,
      onGoToStep: o.goToStep,
      onLoadHistoryTrip: o.onLoadHistoryTrip,
      onTune: o.onTune,
    },
  };
}

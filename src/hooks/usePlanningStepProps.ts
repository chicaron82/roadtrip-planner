import { useCallback } from 'react';
import type React from 'react';
import { PlanningStepContent } from '../components/Steps/PlanningStepContent';
import type { Location, Vehicle, TripSettings, TripSummary, TripMode, TripChallenge, POISuggestion, TripJournal, POI, POICategory, RouteSegment } from '../types';
import type { StylePreset } from '../lib/style-presets';
import type { ViewMode } from './useJournal';
import type { TemplateImportResult } from '../lib/url';
import type { SuggestedStop } from '../lib/stop-suggestions';
import type { PlanningStep } from './useWizard';
import type { StopType, DayType, OvernightStop } from '../types';

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
  setSummary: (s: TripSummary | null) => void;
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
  startJournal: (title?: string) => void;
  updateActiveJournal: (j: TripJournal) => void;
  // Trip state
  tripConfirmed: boolean;
  setTripConfirmed: (v: boolean) => void;
  history: TripSummary[];
  // Added stops
  addedStopCount: number;
  externalStops: SuggestedStop[];
  // Calculation
  shareUrl: string | null;
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  dismissOvernightPrompt: () => void;
  updateStopType: (idx: number, t: StopType) => void;
  updateDayNotes: (day: number, notes: string) => void;
  updateDayTitle: (day: number, title: string) => void;
  updateDayType: (day: number, t: DayType) => void;
  updateDayOvernight: (day: number, o: OvernightStop) => void;
  // POI
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;
  addPOI: (id: string) => void;
  addStop: (poi: POI, segments: RouteSegment[]) => void;
  dismissPOI: (id: string) => void;
  // Actions
  openInGoogleMaps: () => void;
  copyShareLink: () => void;
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

  const handleAddPOI = useCallback((poiId: string) => {
    addPOI(poiId);
    const poi = poiSuggestions.find(p => p.id === poiId);
    if (poi) {
      addStop(
        { id: poi.id, name: poi.name, lat: poi.lat, lng: poi.lng, address: poi.address, category: (POI_CATEGORY_MAP[poi.category] ?? 'attraction') as POICategory },
        summary?.segments ?? []
      );
    }
  }, [addPOI, poiSuggestions, addStop, summary]);

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
    onSelectChallenge: o.handleSelectChallenge,
    activePreset: o.activePreset,
    presetOptions: o.presetOptions,
    onPresetChange: o.handlePresetChange,
    onSharePreset: o.handleSharePreset,
    shareJustCopied: o.shareJustCopied,
    viewMode: o.viewMode,
    setViewMode: o.setViewMode,
    activeJournal: o.activeJournal,
    activeChallenge: o.activeChallenge,
    tripConfirmed: o.tripConfirmed,
    addedStopCount: o.addedStopCount,
    externalStops: o.externalStops,
    history: o.history,
    shareUrl: o.shareUrl,
    showOvernightPrompt: o.showOvernightPrompt,
    suggestedOvernightStop: o.suggestedOvernightStop,
    onDismissOvernight: o.dismissOvernightPrompt,
    onUpdateStopType: o.updateStopType,
    onUpdateDayNotes: o.updateDayNotes,
    onUpdateDayTitle: o.updateDayTitle,
    onUpdateDayType: o.updateDayType,
    onUpdateOvernight: o.updateDayOvernight,
    poiSuggestions: o.poiSuggestions,
    isLoadingPOIs: o.isLoadingPOIs,
    onAddPOI: handleAddPOI,
    onDismissPOI: o.dismissPOI,
    onOpenGoogleMaps: o.openInGoogleMaps,
    onCopyShareLink: o.copyShareLink,
    onStartJournal: o.startJournal,
    onUpdateJournal: o.updateActiveJournal,
    onGoToStep: o.goToStep,
    onConfirmTrip,
    onUnconfirmTrip,
    onLoadHistoryTrip: o.setSummary,
  };
}

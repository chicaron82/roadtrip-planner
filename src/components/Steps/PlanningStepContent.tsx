import React from 'react';
import { Step1Content } from './Step1Content';
import { Step2Content } from './Step2Content';
import { Step3Content } from './Step3Content';
import type {
  Location, Vehicle, TripSettings, TripSummary, TripMode, TripChallenge,
  POISuggestion, TripJournal,
} from '../../types';
import type { StylePreset } from '../../lib/style-presets';
import type { ViewMode } from '../../hooks/useJournal';
import type { TemplateImportResult } from '../../lib/url';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { PlanningStep } from '../../hooks/useWizard';
import type { StopType, DayType, OvernightStop } from '../../types';

interface PlanningStepContentProps {
  planningStep: PlanningStep;
  // Context
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  vehicle: Vehicle;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  summary: TripSummary | null;
  tripMode: TripMode;
  // Step 1
  onShowAdventure: () => void;
  onImportTemplate: (r: TemplateImportResult) => void;
  onSelectChallenge: (c: TripChallenge) => void;
  // Step 2
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  onPresetChange: (p: StylePreset) => void;
  onSharePreset: () => Promise<void>;
  shareJustCopied: boolean;
  // Step 3 — journal & state
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  activeJournal: TripJournal | null;
  activeChallenge: TripChallenge | null;
  tripConfirmed: boolean;
  addedStopCount: number;
  externalStops: SuggestedStop[];
  history: TripSummary[];
  shareUrl: string | null;
  // Step 3 — calc
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  onDismissOvernight: () => void;
  onUpdateStopType: (idx: number, t: StopType) => void;
  onUpdateDayNotes: (day: number, notes: string) => void;
  onUpdateDayTitle: (day: number, title: string) => void;
  onUpdateDayType: (day: number, t: DayType) => void;
  onUpdateOvernight: (day: number, o: OvernightStop) => void;
  // Step 3 — POI
  poiSuggestions: POISuggestion[];
  isLoadingPOIs: boolean;
  onAddPOI: (poiId: string) => void;
  onDismissPOI: (poiId: string) => void;
  // Step 3 — actions
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (j: TripJournal) => void;
  onGoToStep: (step: PlanningStep) => void;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
}

export function PlanningStepContent(p: PlanningStepContentProps) {
  if (p.planningStep === 1) {
    return (
      <Step1Content
        locations={p.locations} setLocations={p.setLocations}
        settings={p.settings} setSettings={p.setSettings}
        tripMode={p.tripMode}
        onShowAdventure={p.onShowAdventure}
        onImportTemplate={p.onImportTemplate}
        onSelectChallenge={p.onSelectChallenge}
      />
    );
  }
  if (p.planningStep === 2) {
    return (
      <Step2Content
        vehicle={p.vehicle} setVehicle={p.setVehicle}
        settings={p.settings} setSettings={p.setSettings}
        tripMode={p.tripMode}
        activePreset={p.activePreset} presetOptions={p.presetOptions}
        onPresetChange={p.onPresetChange}
        onSharePreset={p.onSharePreset}
        shareJustCopied={p.shareJustCopied}
      />
    );
  }
  return (
    <Step3Content
      summary={p.summary} settings={p.settings} vehicle={p.vehicle}
      tripMode={p.tripMode} viewMode={p.viewMode} setViewMode={p.setViewMode}
      activeJournal={p.activeJournal} activeChallenge={p.activeChallenge}
      showOvernightPrompt={p.showOvernightPrompt}
      suggestedOvernightStop={p.suggestedOvernightStop}
      poiSuggestions={p.poiSuggestions} isLoadingPOIs={p.isLoadingPOIs}
      history={p.history} shareUrl={p.shareUrl}
      onOpenGoogleMaps={p.onOpenGoogleMaps}
      onCopyShareLink={p.onCopyShareLink}
      onStartJournal={p.onStartJournal}
      onUpdateJournal={p.onUpdateJournal}
      onUpdateStopType={p.onUpdateStopType}
      onUpdateDayNotes={p.onUpdateDayNotes}
      onUpdateDayTitle={p.onUpdateDayTitle}
      onUpdateDayType={p.onUpdateDayType}
      onUpdateOvernight={p.onUpdateOvernight}
      onDismissOvernight={p.onDismissOvernight}
      onAddPOI={p.onAddPOI} onDismissPOI={p.onDismissPOI}
      onGoToStep={p.onGoToStep}
      externalStops={p.externalStops}
      tripConfirmed={p.tripConfirmed}
      addedStopCount={p.addedStopCount}
      onConfirmTrip={p.onConfirmTrip}
      onUnconfirmTrip={p.onUnconfirmTrip}
    />
  );
}

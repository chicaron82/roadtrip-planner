import React from 'react';
import { Step1Content } from './Step1Content';
import { Step2Content } from './Step2Content';
import { Step3Content, type Step3ContentProps } from './Step3Content';
import type {
  Location, Vehicle, TripSettings, TripSummary, TripMode,
} from '../../types';
import type { StylePreset } from '../../lib/style-presets';
import type { TemplateImportResult } from '../../lib/url';
import type { PlanningStep } from '../../hooks/useWizard';

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
  templateRecommendations?: TemplateImportResult['meta']['recommendations'];
  // Step 2
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  onPresetChange: (p: StylePreset) => void;
  onSharePreset: () => Promise<void>;
  shareJustCopied: boolean;
  step3Props: Step3ContentProps;
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
        templateRecommendations={p.templateRecommendations}
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
    <Step3Content {...p.step3Props} />
  );
}

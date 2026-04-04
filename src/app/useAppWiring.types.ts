/**
 * useAppWiring.types.ts — Shared interfaces for the app wiring layer.
 *
 * Extracted from useAppWiring.ts so sub-hooks (usePlannerWiring, etc.) can
 * import just the types they need without creating circular module references.
 *
 * 💚 My Experience Engine — Wiring Types
 */

import type { ComponentProps } from 'react';
import type {
  Location, Vehicle, TripSettings, TripSummary, TripChallenge, TripJournal,
  TripMode, RouteStrategy, POISuggestion,
  StopType, HistoryTripSnapshot, TripOrigin,
} from '../types';
import type { TemplateImportResult } from '../lib/url';
import type { GhostCarState } from '../hooks';
import type { PlanningStep } from '../hooks';
import type { ViewMode } from '../hooks/journey/useJournal';
import type { PlannerContextType } from '../contexts';
import type { IcebreakerOverlayProps } from '../components/Icebreaker/IcebreakerOverlays';
import type { AdventureMode, AdventureSelection } from '../components/Trip/Adventure/AdventureMode';
import type { MakeMEETimeScreen } from '../components/Trip/Sharing/MakeMEETimeScreen';
import type { AdventureInitialValues } from '../hooks/ui/useAdventureModeController';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import type { FeasibilityStatus } from '../lib/feasibility';
import type { StylePreset } from '../lib/style-presets';
import type { SuggestedStop } from '../lib/stop-suggestions';
import type { AppBoard } from './useAppBoard';
import type { Map } from '../components/Map/Map';

// ── Input ──────────────────────────────────────────────────────────────────

export interface AppWiringInputs {
  tripContext: {
    locations: Location[];
    setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
    vehicle: Vehicle;
    setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
    settings: TripSettings;
    setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
    customTitle: string | null;
    summary: TripSummary | null;
    canonicalTimeline: CanonicalTripTimeline | null;
  };
  
  tripMode: {
    tripMode: TripMode | null;
    showAdventureMode: boolean;
    setShowAdventureMode: (v: boolean) => void;
    showModeSwitcher: boolean;
    setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
    modeSwitcherRef: React.RefObject<HTMLDivElement | null>;
    handleSwitchMode: (mode: TripMode) => void;
    tripActive: boolean;
    setTripActive: (v: boolean) => void;
  };

  map: {
    previewGeometry: [number, number][] | null;
    validRouteGeometry: [number, number][] | null;
    routeFeasibilityStatus: FeasibilityStatus | null | undefined;
    handleMapClick: ComponentProps<typeof Map>['onMapClick'];
    adventurePreview: { lat: number; lng: number; radiusKm: number } | null;
  };

  wizard: {
    planningStep: PlanningStep;
    completedSteps: number[];
    canProceedFromStep1: boolean;
    canProceedFromStep2: boolean;
    goToStep: (step: PlanningStep) => void;
    goToNextStep: () => void;
    goToPrevStep: () => void;
  };

  calculation: {
    isCalculating: boolean;
    routeStrategies: RouteStrategy[];
    activeStrategyIndex: number;
    selectStrategy: (i: number) => void;
    strategicFuelStops: ComponentProps<typeof Map>['strategicFuelStops'];
    shareUrl: string | null;
    showOvernightPrompt: boolean;
    suggestedOvernightStop: Location | null;
    dismissOvernightPrompt: () => void;
    updateStopType: (idx: number, t: StopType) => void;
    calculateAndDiscover: () => Promise<void>;
  };

  poi: {
    poiSuggestions: POISuggestion[];
    poiInference?: POISuggestion[];
  };

  presets: {
    activePreset: StylePreset;
    presetOptions: StylePreset[];
    handlePresetChange: (p: StylePreset) => void;
    handleSharePreset: () => Promise<void>;
    shareJustCopied: boolean;
  };

  tripLoader: {
    activeChallenge: TripChallenge | null;
    tripOrigin: TripOrigin | null;
    templateRecommendations?: TemplateImportResult['meta']['recommendations'];
    pendingTemplate: TemplateImportResult | null;
    handleImportTemplate: (r: TemplateImportResult) => void;
    handleTemplateLoaded?: (r: TemplateImportResult) => void;
    handleDismissPendingTemplate: () => void;
    handleSelectChallenge: (c: TripChallenge) => void;
    handleAdventureSelect: (selection: AdventureSelection) => void;
    setTripMode: (mode: TripMode | null) => void;
  };

  journal: {
    activeJournal: TripJournal | null;
    viewMode: ViewMode;
    setViewMode: (m: ViewMode) => void;
    isJournalComplete: boolean;
    showCompleteOverlay: boolean;
    startJournal: (title?: string) => void;
    skipJournal: () => void;
    journalSkipped: boolean;
    updateActiveJournal: (j: TripJournal) => void;
    confirmComplete: () => void;
    finalizeJournal: () => void;
    clearJournal: () => void;
  };

  session: {
    tripConfirmed: boolean;
    setTripConfirmed: (v: boolean) => void;
    history: HistoryTripSnapshot[];
    hasActiveSession: boolean;
    lastDestination?: string;
    resetTripSession: () => void;
    handleResumeSession: () => void;
    restoreHistoryTripSession: (t: HistoryTripSnapshot) => void;
    addedStopCount: number;
    externalStops: SuggestedStop[];
  };

  voila: {
    showVoila: boolean;
    flyoverActive: boolean;
    showShareScreen: boolean;
    handleShowVoila: () => void;
    handleFlyoverComplete: () => void;
    handleVoilaEdit: () => void;
    handleVoilaLockIn: () => void;
    handleViewFullDetails: () => void;
    handleGoHome: () => void;
    handleMinimizeToVoila: () => void;
    handleReturnToJournal: () => void;
    handleOpenShareScreen: () => void;
    handleCloseShareScreen: () => void;
  };

  features: {
    ghostCar: GhostCarState;
    icebreaker: {
      arcActive: boolean;
      overlayProps: IcebreakerOverlayProps;
      adventureInitialValues?: AdventureInitialValues | null;
      handleLandingSelect: (mode: TripMode) => void;
    };
  };

  sys: {
    error: string | null;
    clearError: () => void;
    copyShareLink: () => void;
    openInGoogleMaps: () => void;
    calculationMessage?: string | null;
    setMapRevealed: (v: boolean) => void;
  };
}

// ── Output ─────────────────────────────────────────────────────────────────

export interface AppWiringOutput {
  board: AppBoard;
  mapProps: ComponentProps<typeof Map>;
  adventureModeProps: ComponentProps<typeof AdventureMode>;
  plannerContextValue: PlannerContextType;
  shareScreenProps: Omit<ComponentProps<typeof MakeMEETimeScreen>, 'onClose'> | null;
  flyoverActive: boolean;
  handleFlyoverComplete: () => void;
}

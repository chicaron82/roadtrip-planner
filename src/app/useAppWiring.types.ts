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
  TripMode, MarkerCategory, POICategory, RouteStrategy, POISuggestion, POI,
  RouteSegment, StopType, HistoryTripSnapshot, TripOrigin,
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
  // Context values
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  vehicle: Vehicle;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  customTitle: string | null;

  // Summary / timeline
  summary: TripSummary | null;
  canonicalTimeline: CanonicalTripTimeline | null;

  // Trip mode
  tripMode: TripMode | null;
  showAdventureMode: boolean;
  setShowAdventureMode: (v: boolean) => void;
  showModeSwitcher: boolean;
  setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  modeSwitcherRef: React.RefObject<HTMLDivElement | null>;
  handleSwitchMode: (mode: TripMode) => void;
  tripActive: boolean;
  setTripActive: (v: boolean) => void;

  // Map
  previewGeometry: [number, number][] | null;
  validRouteGeometry: [number, number][] | null;
  routeFeasibilityStatus: FeasibilityStatus | null | undefined;
  mapDayOptions: ComponentProps<typeof Map>['dayOptions'];
  handleMapClick: ComponentProps<typeof Map>['onMapClick'];
  handleAddPOIFromMap: ComponentProps<typeof Map>['onAddPOI'];
  adventurePreview: { lat: number; lng: number; radiusKm: number } | null;

  // Wizard
  planningStep: PlanningStep;
  completedSteps: number[];
  canProceedFromStep1: boolean;
  canProceedFromStep2: boolean;
  goToStep: (step: PlanningStep) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;

  // Calculation
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

  // POI
  pois: ComponentProps<typeof Map>['pois'];
  markerCategories: MarkerCategory[];
  loadingCategory: string | null;
  handleToggleCategory: (id: POICategory) => void;
  addedPOIIds: ComponentProps<typeof Map>['addedPOIIds'];
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults: boolean;
  poiFetchFailed: boolean;
  addPOI: (id: string) => void;
  addStop: (poi: POI, segments: RouteSegment[], explicitSegmentIndex?: number) => void;
  dismissPOI: (id: string) => void;

  // Style preset
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  handlePresetChange: (p: StylePreset) => void;
  handleSharePreset: () => Promise<void>;
  shareJustCopied: boolean;

  // Trip loader
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

  // Journal
  activeJournal: TripJournal | null;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  isJournalComplete: boolean;
  showCompleteOverlay: boolean;
  startJournal: (title?: string) => void;
  updateActiveJournal: (j: TripJournal) => void;
  confirmComplete: () => void;
  finalizeJournal: () => void;
  clearJournal: () => void;

  // Session
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

  // Voila flow
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

  // Ghost car
  ghostCar: GhostCarState;

  // Icebreaker
  icebreaker: {
    arcActive: boolean;
    overlayProps: IcebreakerOverlayProps;
    adventureInitialValues?: AdventureInitialValues | null;
    handleLandingSelect: (mode: TripMode) => void;
  };

  // Error / UI
  error: string | null;
  clearError: () => void;
  copyShareLink: () => void;
  openInGoogleMaps: () => void;
  calculationMessage?: string | null;
  setMapRevealed: (v: boolean) => void;
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

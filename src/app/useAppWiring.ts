/**
 * useAppWiring — Assembles the props bundles that AppRenderer consumes.
 *
 * Extracted from App.tsx so the root orchestrator stays within its 330-line
 * budget. This hook owns the "compose what the renderer needs" concern:
 *   - useAppBoard call + its massive inputs object
 *   - adventureModeProps assembly
 *   - plannerContextValue assembly
 *   - shareScreenProps assembly
 *
 * No business logic lives here — only prop threading.
 *
 * 💚 My Experience Engine — Wiring
 */

import type { ComponentProps } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, TripChallenge, TripJournal, TripMode, MarkerCategory, POICategory, RouteStrategy, POISuggestion, POI, RouteSegment, StopType } from '../types';
import type { TripOrigin } from '../types';
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
import type { HistoryTripSnapshot } from '../types';
import { useAppBoard, type AppBoard } from './useAppBoard';
import { useAppTemplateHandlers } from '../hooks/session';
import { usePlanningStepProps, useMapProps } from '../hooks';
import type { Map } from '../components/Map/Map';
import { getWeightedFuelEconomyL100km } from '../lib/unit-conversions';

// ── Input ─────────────────────────────────────────────────────────────────

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

  // Error
  error: string | null;
  clearError: () => void;
  copyShareLink: () => void;
  openInGoogleMaps: () => void;
  calculationMessage?: string | null;

  // Map reveal callback — setMapRevealed
  setMapRevealed: (v: boolean) => void;
}

// ── Output ────────────────────────────────────────────────────────────────

export interface AppWiringOutput {
  board: AppBoard;
  mapProps: ComponentProps<typeof Map>;
  adventureModeProps: ComponentProps<typeof AdventureMode>;
  plannerContextValue: PlannerContextType;
  shareScreenProps: Omit<ComponentProps<typeof MakeMEETimeScreen>, 'onClose'> | null;
  flyoverActive: boolean;
  handleFlyoverComplete: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAppWiring(i: AppWiringInputs): AppWiringOutput {
  // ── Derived booleans ──────────────────────────────────────────────────
  const canProceed = i.planningStep === 1 ? i.canProceedFromStep1 : i.canProceedFromStep2;
  const showPostTrip = !!i.activeJournal?.finalized && i.tripConfirmed && !i.showVoila;
  const showJournalAtAGlance = i.tripConfirmed && i.viewMode === 'journal' && !i.showVoila && !!i.activeJournal && !showPostTrip;

  // ── Template handlers ─────────────────────────────────────────────────
  const { handleBuildFromTemplate, handleOpenPlannerFromTemplate } = useAppTemplateHandlers({
    handleImportTemplate: i.handleImportTemplate,
    handleDismissPendingTemplate: i.handleDismissPendingTemplate,
    setTripMode: i.setTripMode,
    calculateAndDiscover: i.calculateAndDiscover,
  });

  // ── Planning step props ───────────────────────────────────────────────
  const stepProps = usePlanningStepProps({
    planningStep: i.planningStep, goToStep: i.goToStep,
    locations: i.locations, setLocations: i.setLocations,
    vehicle: i.vehicle, setVehicle: i.setVehicle,
    settings: i.settings, setSettings: i.setSettings,
    summary: i.summary, tripMode: i.tripMode ?? 'plan',
    setShowAdventureMode: i.setShowAdventureMode,
    handleImportTemplate: i.handleImportTemplate, handleTemplateLoaded: i.handleTemplateLoaded,
    handleSelectChallenge: i.handleSelectChallenge,
    activeChallenge: i.activeChallenge, templateRecommendations: i.templateRecommendations,
    activePreset: i.activePreset, presetOptions: i.presetOptions,
    handlePresetChange: i.handlePresetChange, handleSharePreset: i.handleSharePreset,
    shareJustCopied: i.shareJustCopied,
    viewMode: i.viewMode, setViewMode: i.setViewMode,
    activeJournal: i.activeJournal, isJournalComplete: i.isJournalComplete,
    showCompleteOverlay: i.showCompleteOverlay, startJournal: i.startJournal,
    updateActiveJournal: i.updateActiveJournal, confirmJournalComplete: i.confirmComplete,
    tripConfirmed: i.tripConfirmed, setTripConfirmed: i.setTripConfirmed,
    history: i.history,
    addedStopCount: i.addedStopCount, externalStops: i.externalStops,
    shareUrl: i.shareUrl, showOvernightPrompt: i.showOvernightPrompt,
    suggestedOvernightStop: i.suggestedOvernightStop, dismissOvernightPrompt: i.dismissOvernightPrompt,
    updateStopType: i.updateStopType,
    poiSuggestions: i.poiSuggestions, poiInference: i.poiInference,
    isLoadingPOIs: i.isLoadingPOIs, poiPartialResults: i.poiPartialResults,
    poiFetchFailed: i.poiFetchFailed, addPOI: i.addPOI, addStop: i.addStop, dismissPOI: i.dismissPOI,
    openInGoogleMaps: i.openInGoogleMaps, copyShareLink: i.copyShareLink,
    openShareScreen: i.handleOpenShareScreen,
    onLoadHistoryTrip: i.restoreHistoryTripSession,
    precomputedEvents: i.canonicalTimeline?.events,
    isCalculating: i.isCalculating,
    calculateAndDiscover: i.calculateAndDiscover,
  });

  // ── Map props ─────────────────────────────────────────────────────────
  const mapProps = useMapProps({
    locations: i.locations, validRouteGeometry: i.validRouteGeometry,
    routeFeasibilityStatus: i.routeFeasibilityStatus,
    pois: i.pois, markerCategories: i.markerCategories,
    tripActive: i.tripActive, strategicFuelStops: i.strategicFuelStops,
    addedPOIIds: i.addedPOIIds, mapDayOptions: i.mapDayOptions,
    handleMapClick: i.handleMapClick, routeDetails: i.summary,
    handleAddPOIFromMap: i.handleAddPOIFromMap,
    previewGeometry: i.previewGeometry, tripMode: i.tripMode,
    routeStrategies: i.routeStrategies, activeStrategyIndex: i.activeStrategyIndex,
    selectStrategy: i.selectStrategy, units: i.settings.units,
    adventurePreview: i.adventurePreview,
  });

  // ── Board (headquarters) ──────────────────────────────────────────────
  const board = useAppBoard({
    showVoila: i.showVoila, showShareScreen: i.showShareScreen,
    handleOpenShareScreen: i.handleOpenShareScreen, handleCloseShareScreen: i.handleCloseShareScreen,
    handleVoilaEdit: i.handleVoilaEdit, handleVoilaLockIn: i.handleVoilaLockIn,
    handleGoHome: i.handleGoHome, handleViewFullDetails: i.handleViewFullDetails,
    handleFinalizeJournal: i.finalizeJournal,
    handleStartFresh: () => { i.resetTripSession(); i.handleGoHome(); },
    handleMinimizeToVoila: i.handleMinimizeToVoila,
    handleReturnToJournal: i.handleReturnToJournal,
    pendingTemplate: i.pendingTemplate, handleBuildFromTemplate, handleOpenPlannerFromTemplate,
    handleDismissPendingTemplate: i.handleDismissPendingTemplate,
    tripMode: i.tripMode, planningStep: i.planningStep,
    tripConfirmed: i.tripConfirmed, hasSummary: !!i.summary,
    arcActive: i.icebreaker.arcActive,
    icebreakerOverlayProps: i.icebreaker.overlayProps,
    showAdventureMode: i.showAdventureMode, showJournalAtAGlance, showPostTrip,
    voilaProps: {
      summary: i.summary!,
      settings: i.settings,
      locations: i.locations,
      customTitle: i.customTitle,
      printInput: stepProps.step3Props.controller.commit?.printInput ?? undefined,
      precomputedEvents: stepProps.step3Props.controller.commit?.precomputedEvents ?? undefined,
      feasibility: stepProps.step3Props.controller.feasibility ?? undefined,
    },
    plannerProps: {
      onRevealChange: i.setMapRevealed,
      stepProps,
      liveReflection: i.summary ? { summary: i.summary, vehicle: i.vehicle, settings: i.settings } : null,
      routeStrategyProps: {
        strategies: i.routeStrategies,
        activeIndex: i.activeStrategyIndex,
        onSelect: i.selectStrategy,
        units: i.settings.units,
        isRoundTrip: i.settings.isRoundTrip,
      },
      tripSummaryProps: {
        summary: i.summary!,
        settings: i.settings,
        tripActive: i.tripActive,
        onStop: () => i.setTripActive(false),
        onOpenVehicleTab: () => i.goToStep(2),
      },
    },
    templatePreviewProps: { pendingTemplate: i.pendingTemplate },
    journalAtAGlanceProps: {
      summary: i.summary!,
      settings: i.settings,
      activeJournal: i.activeJournal,
      ghostCar: i.ghostCar,
      onUpdateJournal: i.updateActiveJournal,
    },
    postTripProps: i.activeJournal?.finalized && i.summary ? {
      journal: i.activeJournal,
      summary: i.summary,
      settings: i.settings,
    } : null,
    landingProps: {
      onSelectMode: i.icebreaker.handleLandingSelect,
      hasSavedTrip: i.history.length > 0,
      onContinueSavedTrip: () => i.setTripMode('plan'),
      hasActiveSession: i.hasActiveSession,
      onResumeSession: i.handleResumeSession,
      lastDestination: i.lastDestination,
    },
  });

  // ── Adventure mode props ──────────────────────────────────────────────
  const adventureModeProps: ComponentProps<typeof AdventureMode> = {
    origin: i.locations.find(l => l.type === 'origin') || null,
    initialValues: i.icebreaker.adventureInitialValues ?? undefined,
    onOriginChange: (newOrigin) => {
      i.setLocations(prev => prev.map(loc => loc.type === 'origin' ? { ...loc, ...newOrigin } : loc));
    },
    onSelectDestination: i.handleAdventureSelect,
    onSelectChallenge: (challenge) => { i.handleSelectChallenge(challenge); i.setShowAdventureMode(false); },
    onClose: () => i.setShowAdventureMode(false),
    fuelCostPerKm: (getWeightedFuelEconomyL100km(i.vehicle, i.settings.units) / 100) * i.settings.gasPrice,
  };

  // ── Planner context value ─────────────────────────────────────────────
  const plannerContextValue: PlannerContextType = {
    planningStep: i.planningStep, completedSteps: i.completedSteps, canProceed,
    isCalculating: i.isCalculating,
    onStepClick: i.goToStep,
    onNext: i.goToNextStep,
    onBack: i.goToPrevStep,
    onReset: i.resetTripSession,
    tripMode: i.tripMode!,
    showModeSwitcher: i.showModeSwitcher, setShowModeSwitcher: i.setShowModeSwitcher,
    modeSwitcherRef: i.modeSwitcherRef,
    onSwitchMode: i.handleSwitchMode,
    onGoHome: i.handleGoHome,
    ghostCar: board.uiFlags.ghostCarActive ? i.ghostCar : null,
    markerCategories: i.markerCategories, loadingCategory: i.loadingCategory,
    onToggleCategory: i.handleToggleCategory,
    error: i.error, onClearError: i.clearError,
    calculationMessage: i.calculationMessage,
  };

  // ── Share screen props ────────────────────────────────────────────────
  const shareScreenProps: Omit<ComponentProps<typeof MakeMEETimeScreen>, 'onClose'> | null =
    stepProps.step3Props.controller.commit?.printInput ? {
      printInput: stepProps.step3Props.controller.commit.printInput,
      journal: i.activeJournal,
      tripOrigin: i.tripOrigin,
    } : null;

  return {
    board,
    mapProps,
    adventureModeProps,
    plannerContextValue,
    shareScreenProps,
    flyoverActive: i.flyoverActive,
    handleFlyoverComplete: i.handleFlyoverComplete,
  };
}

/**
 * usePlannerWiring — Planner shell, map, context, and adventure props assembly.
 *
 * Sub-hook of useAppWiring. Owns the "compose what the planner shell needs"
 * concern:
 *   - useAppTemplateHandlers (build/open-in-planner callbacks)
 *   - usePlanningStepProps → stepProps (the step content prop tree)
 *   - useMapProps → mapProps (the map component props)
 *   - adventureModeProps assembly
 *   - plannerContextValue assembly
 *
 * No business logic. Pure prop threading.
 *
 * 💚 My Experience Engine — Planner Wiring
 */

import type { ComponentProps } from 'react';
import type { PlannerContextType } from '../contexts';
import type { TemplateImportResult } from '../lib/url';
import type { AdventureMode } from '../components/Trip/Adventure/AdventureMode';
import type { AppWiringInputs } from './useAppWiring.types';
import { useAppTemplateHandlers } from '../hooks/session';
import { usePlanningStepProps, useMapProps } from '../hooks';
import { getWeightedFuelEconomyL100km } from '../lib/unit-conversions';

// ── Output ─────────────────────────────────────────────────────────────────

export interface PlannerWiringOutput {
  stepProps: ReturnType<typeof usePlanningStepProps>;
  mapProps: ReturnType<typeof useMapProps>;
  adventureModeProps: ComponentProps<typeof AdventureMode>;
  plannerContextValue: PlannerContextType;
  handleBuildFromTemplate: (modified: TemplateImportResult) => void;
  handleOpenPlannerFromTemplate: (modified: TemplateImportResult) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePlannerWiring(i: AppWiringInputs): PlannerWiringOutput {
  // ── canProceed (feeds plannerContextValue) ────────────────────────────
  const canProceed = i.planningStep === 1 ? i.canProceedFromStep1 : i.canProceedFromStep2;

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
  // ghostCarActive: inline derivation (mirrors app-screen-policy getUIFlags) to
  // avoid a dependency on board output. Same three sources: tripConfirmed +
  // planningStep + hasSummary.
  const ghostCarActive = i.tripConfirmed && i.planningStep === 3 && !!i.summary;
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
    ghostCar: ghostCarActive ? i.ghostCar : null,
    markerCategories: i.markerCategories, loadingCategory: i.loadingCategory,
    onToggleCategory: i.handleToggleCategory,
    error: i.error, onClearError: i.clearError,
    calculationMessage: i.calculationMessage,
  };

  return {
    stepProps,
    mapProps,
    adventureModeProps,
    plannerContextValue,
    handleBuildFromTemplate,
    handleOpenPlannerFromTemplate,
  };
}

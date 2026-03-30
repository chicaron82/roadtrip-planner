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
  const canProceed = i.wizard.planningStep === 1 ? i.wizard.canProceedFromStep1 : i.wizard.canProceedFromStep2;

  // ── Template handlers ─────────────────────────────────────────────────
  const { handleBuildFromTemplate, handleOpenPlannerFromTemplate } = useAppTemplateHandlers({
    handleImportTemplate: i.tripLoader.handleImportTemplate,
    handleDismissPendingTemplate: i.tripLoader.handleDismissPendingTemplate,
    setTripMode: i.tripLoader.setTripMode,
    calculateAndDiscover: i.calculation.calculateAndDiscover,
  });

  // ── Planning step props ───────────────────────────────────────────────
  const stepProps = usePlanningStepProps({
    planningStep: i.wizard.planningStep, goToStep: i.wizard.goToStep,
    locations: i.tripContext.locations, setLocations: i.tripContext.setLocations,
    vehicle: i.tripContext.vehicle, setVehicle: i.tripContext.setVehicle,
    settings: i.tripContext.settings, setSettings: i.tripContext.setSettings,
    summary: i.tripContext.summary, tripMode: i.tripMode.tripMode ?? 'plan',
    setShowAdventureMode: i.tripMode.setShowAdventureMode,
    handleImportTemplate: i.tripLoader.handleImportTemplate, handleTemplateLoaded: i.tripLoader.handleTemplateLoaded,
    handleSelectChallenge: i.tripLoader.handleSelectChallenge,
    activeChallenge: i.tripLoader.activeChallenge, templateRecommendations: i.tripLoader.templateRecommendations,
    activePreset: i.presets.activePreset, presetOptions: i.presets.presetOptions,
    handlePresetChange: i.presets.handlePresetChange, handleSharePreset: i.presets.handleSharePreset,
    shareJustCopied: i.presets.shareJustCopied,
    viewMode: i.journal.viewMode, setViewMode: i.journal.setViewMode,
    activeJournal: i.journal.activeJournal, isJournalComplete: i.journal.isJournalComplete,
    showCompleteOverlay: i.journal.showCompleteOverlay, startJournal: i.journal.startJournal,
    updateActiveJournal: i.journal.updateActiveJournal, confirmJournalComplete: i.journal.confirmComplete,
    tripConfirmed: i.session.tripConfirmed, setTripConfirmed: i.session.setTripConfirmed,
    history: i.session.history,
    addedStopCount: i.session.addedStopCount, externalStops: i.session.externalStops,
    shareUrl: i.calculation.shareUrl, showOvernightPrompt: i.calculation.showOvernightPrompt,
    suggestedOvernightStop: i.calculation.suggestedOvernightStop, dismissOvernightPrompt: i.calculation.dismissOvernightPrompt,
    updateStopType: i.calculation.updateStopType,
    poiSuggestions: i.poi.poiSuggestions, poiInference: i.poi.poiInference,
    isLoadingPOIs: i.poi.isLoadingPOIs, poiPartialResults: i.poi.poiPartialResults,
    poiFetchFailed: i.poi.poiFetchFailed, addPOI: i.poi.addPOI, addStop: i.poi.addStop, dismissPOI: i.poi.dismissPOI,
    openInGoogleMaps: i.sys.openInGoogleMaps, copyShareLink: i.sys.copyShareLink,
    openShareScreen: i.voila.handleOpenShareScreen,
    onLoadHistoryTrip: i.session.restoreHistoryTripSession,
    precomputedEvents: i.tripContext.canonicalTimeline?.events,
    isCalculating: i.calculation.isCalculating,
    calculateAndDiscover: i.calculation.calculateAndDiscover,
  });

  // ── Map props ─────────────────────────────────────────────────────────
  const mapProps = useMapProps({
    locations: i.tripContext.locations, validRouteGeometry: i.map.validRouteGeometry,
    routeFeasibilityStatus: i.map.routeFeasibilityStatus,
    pois: i.poi.pois, markerCategories: i.poi.markerCategories,
    tripActive: i.tripMode.tripActive, strategicFuelStops: i.calculation.strategicFuelStops,
    addedPOIIds: i.poi.addedPOIIds, mapDayOptions: i.map.mapDayOptions,
    handleMapClick: i.map.handleMapClick, routeDetails: i.tripContext.summary,
    handleAddPOIFromMap: i.map.handleAddPOIFromMap,
    previewGeometry: i.map.previewGeometry, tripMode: i.tripMode.tripMode,
    routeStrategies: i.calculation.routeStrategies, activeStrategyIndex: i.calculation.activeStrategyIndex,
    selectStrategy: i.calculation.selectStrategy, units: i.tripContext.settings.units,
    adventurePreview: i.map.adventurePreview,
  });

  // ── Adventure mode props ──────────────────────────────────────────────
  const adventureModeProps: ComponentProps<typeof AdventureMode> = {
    origin: i.tripContext.locations.find(l => l.type === 'origin') || null,
    initialValues: i.features.icebreaker.adventureInitialValues ?? undefined,
    onOriginChange: (newOrigin) => {
      i.tripContext.setLocations(prev => prev.map(loc => loc.type === 'origin' ? { ...loc, ...newOrigin } : loc));
    },
    onSelectDestination: i.tripLoader.handleAdventureSelect,
    onSelectChallenge: (challenge) => { i.tripLoader.handleSelectChallenge(challenge); i.tripMode.setShowAdventureMode(false); },
    onClose: () => i.tripMode.setShowAdventureMode(false),
    fuelCostPerKm: (getWeightedFuelEconomyL100km(i.tripContext.vehicle, i.tripContext.settings.units) / 100) * i.tripContext.settings.gasPrice,
  };

  // ── Planner context value ─────────────────────────────────────────────
  // ghostCarActive: inline derivation (mirrors app-screen-policy getUIFlags) to
  // avoid a dependency on board output. Same three sources: tripConfirmed +
  // planningStep + hasSummary.
  const ghostCarActive = i.session.tripConfirmed && i.wizard.planningStep === 3 && !!i.tripContext.summary;
  const plannerContextValue: PlannerContextType = {
    planningStep: i.wizard.planningStep, completedSteps: i.wizard.completedSteps, canProceed,
    isCalculating: i.calculation.isCalculating,
    onStepClick: i.wizard.goToStep,
    onNext: i.wizard.goToNextStep,
    onBack: i.wizard.goToPrevStep,
    onReset: i.session.resetTripSession,
    tripMode: i.tripMode.tripMode!,
    showModeSwitcher: i.tripMode.showModeSwitcher, setShowModeSwitcher: i.tripMode.setShowModeSwitcher,
    modeSwitcherRef: i.tripMode.modeSwitcherRef,
    onSwitchMode: i.tripMode.handleSwitchMode,
    onGoHome: i.voila.handleGoHome,
    ghostCar: ghostCarActive ? i.features.ghostCar : null,
    markerCategories: i.poi.markerCategories, loadingCategory: i.poi.loadingCategory,
    onToggleCategory: i.poi.handleToggleCategory,
    error: i.sys.error, onClearError: i.sys.clearError,
    calculationMessage: i.sys.calculationMessage,
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

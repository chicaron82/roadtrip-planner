import { useRef, useState, useLayoutEffect, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './components/UI/ErrorFallback';
import { useIcebreakerOrchestrator } from './components/Icebreaker/IcebreakerOrchestrator';
import './styles/sidebar.css';
import { TripProvider, useTimeline, useTripCore } from './contexts';
import { useAppBoard } from './app/useAppBoard';
import { AppRenderer } from './app/AppRenderer';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  usePlanningStepProps, useCalculateAndDiscover, useMapProps, useGhostCar,
  useAppCallbacks, useArrivalSnap, useCalculationMessages,
} from './hooks';
import { useSessionLifecycle, useVoilaFlow, useAppTemplateHandlers, useAppBackPress } from './hooks/session';
import { getWeightedFuelEconomyL100km } from './lib/unit-conversions';

const Map = lazy(() => import('./components/Map/Map').then(m => ({ default: m.Map })));

/** App.tsx — Root orchestrator. Full-bleed map + floating glass panel. 💚 My Experience Engine */
function AppContent() {
  // ── Context ──────────────────────────────────────────────────────────────
  const { locations, setLocations, vehicle, setVehicle, settings, setSettings, icebreakerOrigin, setIcebreakerOrigin, customTitle, setCustomTitle } = useTripCore();
  const { summary, canonicalTimeline } = useTimeline();

  // ── L1: Independent state ─────────────────────────────────────────────────
  const previewGeometry = useEagerRoute(locations);
  const onCalcCompleteRef = useRef<() => void>(() => {});
  const [tripConfirmed, setTripConfirmed] = useState(false);
  const [mapRevealed, setMapRevealed] = useState(false);
  const [adventurePreview, setAdventurePreview] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);

  const {
    tripMode, setTripMode,
    showAdventureMode, setShowAdventureMode,
    showModeSwitcher, setShowModeSwitcher,
    modeSwitcherRef,
    tripActive, setTripActive,
    handleSwitchMode,
  } = useTripMode();

  const {
    activePreset, presetOptions, shareJustCopied,
    handlePresetChange, handleSharePreset,
    setAdaptiveDefaults, refreshAdaptiveDefaults,
  } = useStylePreset({ setSettings });

  const {
    pois, markerCategories, loadingCategory, poiSuggestions, poiInference, isLoadingPOIs,
    poiPartialResults, poiFetchFailed,
    error: poiError, toggleCategory, addPOI, dismissPOI,
    clearError: clearPOIError, resetPOIs,
  } = usePOI({
    routeGeometry: summary?.fullGeometry,
    segments: summary?.segments,
    origin: locations.find(l => l.type === 'origin'),
    destination: locations.find(l => l.type === 'destination'),
    tripPreferences: settings.tripPreferences,
    roundTripMidpoint: summary?.roundTripMidpoint,
  });

  const { addedStops, addedPOIIds, addStop, clearStops, asSuggestedStops, externalStops } =
    useAddedStops(summary, settings);

  // ── L2: Calculation ───────────────────────────────────────────────────────
  const {
    isCalculating, error: calcError, shareUrl,
    strategicFuelStops, showOvernightPrompt, suggestedOvernightStop,
    dismissOvernightPrompt, calculateTrip,
    routeStrategies, activeStrategyIndex, selectStrategy,
    updateStopType,
    clearError: clearCalcError, clearTripCalculation,
  } = useTripCalculation({
    locations, vehicle, settings,
    onCalculationComplete: () => onCalcCompleteRef.current(),
    externalStops,
  });

  const { calculateAndDiscover } = useCalculateAndDiscover({
    calculateTrip, settings, setTripConfirmed,
    refreshAdaptiveDefaults, setAdaptiveDefaults,
  });

  const {
    planningStep, completedSteps, canProceedFromStep1, canProceedFromStep2,
    goToNextStep: wizardNext, goToPrevStep, goToStep, forceStep,
    markStepComplete, resetWizard,
  } = useWizard({ locations, vehicle, onCalculate: calculateAndDiscover });

  // ── Trip loading & cross-cutting ─────────────────────────────────────────
  const {
    activeChallenge, tripOrigin,
    templateRecommendations,
    pendingTemplate,
    setActiveChallenge, setTripOrigin,
    handleImportTemplate, handleTemplateLoaded, handleDismissPendingTemplate,
    handleSelectChallenge, handleAdventureSelect,
  } = useTripLoader({
    setLocations, setVehicle, setSettings, setTripMode,
    markStepComplete, forceStep, goToStep,
    onAdventureComplete: () => setShowAdventureMode(false),
  });

  const { activeJournal, viewMode, startJournal, updateActiveJournal, setViewMode, clearJournal, isJournalComplete, isLoading: isJournalLoading, showCompleteOverlay, confirmComplete, error: journalError, clearError: clearJournalError } =
    useJournal({ summary, settings, vehicle, origin: tripOrigin, defaultTitle: activeChallenge?.title });

  const {
    validRouteGeometry, routeFeasibilityStatus, mapDayOptions,
    handleMapClick, handleAddPOIFromMap, openInGoogleMaps,
    copyShareLink: triggerCopyShareLink,
  } = useMapInteractions({
    locations,
    setLocations,
    routeSummary: summary,
    feasibilitySummary: summary,
    settings,
    addStop,
  });

  useURLHydration({
    setLocations, setVehicle, setSettings,
    locations, settings, summary,
    markStepComplete, forceStep,
    setAdaptiveDefaults,
  });

  const { error, clearError, copyShareLink, handleToggleCategory, goToNextStep, handleResumeSession } =
    useAppCallbacks({
      poiError, calcError, journalError, clearPOIError, clearCalcError, clearJournalError,
      triggerCopyShareLink, shareUrl,
      locations, toggleCategory, validRouteGeometry,
      planningStep, calculateAndDiscover, wizardNext,
      setTripMode,
    });

  // ── L3: Live journey experience ───────────────────────────────────────────
  const ghostCar = useGhostCar(canonicalTimeline, summary, settings, asSuggestedStops);
  useArrivalSnap(ghostCar.anchorAt, ghostCar.anchorAtKm, summary?.segments ?? [], !!summary && tripConfirmed);


  // ── Session / lifecycle ───────────────────────────────────────────────────
  const { history, hasActiveSession, lastDestination, resetTripSession, selectTripMode, restoreHistoryTripSession } = useSessionLifecycle({
    locations, settings, tripConfirmed,
    setLocations, setSettings, setTripConfirmed, setTripMode, setShowAdventureMode,
    setActiveChallenge, setTripOrigin, resetPOIs, resetWizard, clearStops, clearTripCalculation, clearJournal,
    calculateAndDiscover, forceStep, markStepComplete,
  });

  const calculationMessage = useCalculationMessages(isCalculating, locations, icebreakerOrigin);

  // ── Voila Flow (CEO of post-calculation reveal) ───────────────────────────
  const {
    showVoila, flyoverActive, showShareScreen, triggerFlyover,
    handleShowVoila, handleFlyoverComplete, handleVoilaEdit, handleVoilaLockIn, handleViewFullDetails, handleGoHome,
    handleOpenShareScreen, handleCloseShareScreen,
  } = useVoilaFlow({ icebreakerOrigin, isCalculating, setTripMode, goToStep, forceStep, setTripConfirmed });

  // ── Icebreaker orchestrator (Four-Beat Arc + icebreaker gate + estimate workshop) ──
  const icebreaker = useIcebreakerOrchestrator({
    locations, setLocations, vehicle, setVehicle, settings, setSettings, setIcebreakerOrigin,
    markStepComplete, forceStep,
    tripMode, setTripMode, selectTripMode, setShowAdventureMode,
    calculateAndDiscover, isCalculating, summary, calculationMessage, calcError,
    setAdventurePreview, onShowVoila: handleShowVoila, customTitle, setCustomTitle,
  });

  useLayoutEffect(() => {
    onCalcCompleteRef.current = () => {
      if (icebreaker.onCalcComplete()) return;
      // Classic wizard path: trigger Flyover → VoilaScreen
      markStepComplete(1); markStepComplete(2);
      triggerFlyover();
    };
  });

  // ── Android back button guard ─────────────────────────────────────────────
  useAppBackPress({ activeJournal, viewMode, setViewMode, icebreaker, tripMode, planningStep, goToStep });

  // Auto-start journal on lock-in. Creates a fresh journal each time —
  // if a completed journal exists it is archived in IndexedDB and replaced.
  // In-progress journals are preserved (mid-trip page reload recovery).
  // 700ms delay lets StepsBanner's wizard→trip morph play first.
  useEffect(() => {
    if (!tripConfirmed || !summary || showVoila) return;
    if (activeJournal && !isJournalComplete) return; // in-progress — don't override
    if (isJournalLoading) return;                    // creation already in flight
    const t = setTimeout(() => { void startJournal(customTitle ?? undefined); }, 700);
    return () => clearTimeout(t);
  }, [tripConfirmed, showVoila, activeJournal, isJournalComplete, isJournalLoading, summary, startJournal, customTitle]);



  // ── Derived props ─────────────────────────────────────────────────────────
  const mapProps = useMapProps({
    locations, validRouteGeometry, routeFeasibilityStatus,
    pois, markerCategories, tripActive, strategicFuelStops, addedPOIIds,
    mapDayOptions, handleMapClick, routeDetails: summary, handleAddPOIFromMap,
    previewGeometry, tripMode, routeStrategies, activeStrategyIndex, selectStrategy,
    units: settings.units, adventurePreview,
  });

  const canProceed = planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2;
  const showJournalAtAGlance = tripConfirmed && viewMode === 'journal' && !showVoila && !!activeJournal;

  const { handleBuildFromTemplate, handleOpenPlannerFromTemplate } = useAppTemplateHandlers({
    handleImportTemplate, handleDismissPendingTemplate, setTripMode, calculateAndDiscover,
  });
  const stepProps = usePlanningStepProps({
    planningStep, goToStep,
    locations, setLocations, vehicle, setVehicle, settings, setSettings,
    summary, tripMode: tripMode ?? 'plan',
    setShowAdventureMode,
    handleImportTemplate, handleTemplateLoaded, handleSelectChallenge, activeChallenge, templateRecommendations,
    activePreset, presetOptions, handlePresetChange, handleSharePreset, shareJustCopied,
    viewMode, setViewMode, activeJournal, isJournalComplete, showCompleteOverlay, startJournal, updateActiveJournal, confirmJournalComplete: confirmComplete,
    tripConfirmed, setTripConfirmed, history,
    addedStopCount: addedStops.length,
    externalStops,
    shareUrl, showOvernightPrompt, suggestedOvernightStop, dismissOvernightPrompt,
    updateStopType,
    poiSuggestions, poiInference, isLoadingPOIs, poiPartialResults, poiFetchFailed, addPOI, addStop, dismissPOI,
    openInGoogleMaps, copyShareLink, openShareScreen: handleOpenShareScreen,
    onLoadHistoryTrip: restoreHistoryTripSession,
    precomputedEvents: canonicalTimeline?.events,
    isCalculating,
    calculateAndDiscover,
  });

  // ── Board (headquarters — authority + props bundles) ──────────────────────
  const board = useAppBoard({
    showVoila, showShareScreen,
    handleOpenShareScreen, handleCloseShareScreen,
    handleVoilaEdit, handleVoilaLockIn, handleGoHome, handleViewFullDetails,
    pendingTemplate, handleBuildFromTemplate, handleOpenPlannerFromTemplate, handleDismissPendingTemplate,
    tripMode, planningStep, tripConfirmed, hasSummary: !!summary,
    arcActive: icebreaker.arcActive,
    icebreakerOverlayProps: icebreaker.overlayProps,
    showAdventureMode, showJournalAtAGlance,
    voilaProps: {
      summary: summary!,
      settings,
      locations,
      customTitle,
      printInput: stepProps.step3Props.controller.commit?.printInput ?? undefined,
      precomputedEvents: stepProps.step3Props.controller.commit?.precomputedEvents ?? undefined,
      feasibility: stepProps.step3Props.controller.feasibility ?? undefined,
    },
    plannerProps: {
      onRevealChange: setMapRevealed,
      stepProps,
      liveReflection: summary ? { summary, vehicle, settings } : null,
      routeStrategyProps: {
        strategies: routeStrategies,
        activeIndex: activeStrategyIndex,
        onSelect: selectStrategy,
        units: settings.units,
        isRoundTrip: settings.isRoundTrip,
      },
      tripSummaryProps: {
        summary: summary!,
        settings,
        tripActive,
        onStop: () => setTripActive(false),
        onOpenVehicleTab: () => goToStep(2),
      },
    },
    templatePreviewProps: { pendingTemplate },
    journalAtAGlanceProps: {
      summary: summary!,
      settings,
      activeJournal,
      ghostCar,
      onUpdateJournal: updateActiveJournal,
    },
    landingProps: {
      onSelectMode: icebreaker.handleLandingSelect,
      hasSavedTrip: history.length > 0,
      onContinueSavedTrip: () => setTripMode('plan'),
      hasActiveSession,
      onResumeSession: handleResumeSession,
      lastDestination,
    },
  });

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Suspense fallback={<div className="w-full h-full bg-[#1c1c1e] animate-pulse" />}>
            <Map
              {...mapProps}
              flyoverActive={flyoverActive}
              onFlyoverComplete={handleFlyoverComplete}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <AppRenderer
        board={board}
        mapRevealed={mapRevealed}
        adventureModeProps={{
          origin: locations.find(l => l.type === 'origin') || null,
          initialValues: icebreaker.adventureInitialValues ?? undefined,
          onOriginChange: (newOrigin) => {
            setLocations(prev => prev.map(loc => loc.type === 'origin' ? { ...loc, ...newOrigin } : loc));
          },
          onSelectDestination: handleAdventureSelect,
          onSelectChallenge: (challenge) => { handleSelectChallenge(challenge); setShowAdventureMode(false); },
          onClose: () => setShowAdventureMode(false),
          fuelCostPerKm: (getWeightedFuelEconomyL100km(vehicle, settings.units) / 100) * settings.gasPrice,
        }}
        plannerContextValue={{
          planningStep, completedSteps, canProceed,
          isCalculating,
          onStepClick: goToStep,
          onNext: goToNextStep,
          onBack: goToPrevStep,
          onReset: resetTripSession,
          tripMode: tripMode!,
          showModeSwitcher, setShowModeSwitcher, modeSwitcherRef,
          onSwitchMode: handleSwitchMode,
          onGoHome: handleGoHome,
          ghostCar: board.uiFlags.ghostCarActive ? ghostCar : null,
          markerCategories, loadingCategory,
          onToggleCategory: handleToggleCategory,
          error, onClearError: clearError,
          calculationMessage,
        }}
        shareScreenProps={stepProps.step3Props.controller.commit?.printInput ? {
          printInput: stepProps.step3Props.controller.commit.printInput,
          journal: activeJournal,
        } : null}
      />
    </div>
  );
}

function App() {
  return (
    <TripProvider>
      <AppContent />
    </TripProvider>
  );
}

export default App;

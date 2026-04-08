import { useRef, useState, useLayoutEffect, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './components/UI/ErrorFallback';
import { useIcebreakerOrchestrator } from './components/Icebreaker/IcebreakerOrchestrator';
import './styles/sidebar.css';
import { TripProvider, useTimeline, useTripCore } from './contexts';
import { AppRenderer } from './app/AppRenderer';
import { useAppWiring } from './app/useAppWiring';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  useCalculateAndDiscover, useGhostCar,
  useAppCallbacks, useArrivalSnap,
} from './hooks';
import { useSessionLifecycle, useVoilaFlow, useAppBackPress } from './hooks/session';
import { buildSeededTitle } from './lib/trip-title-seeds';

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
    poiSuggestions, poiInference,
    clearError: clearPOIError, resetPOIs,
  } = usePOI({
    routeGeometry: summary?.fullGeometry,
    summary: summary,
    origin: locations.find(l => l.type === 'origin'),
    destination: locations.find(l => l.type === 'destination'),
    tripPreferences: settings.tripPreferences,
    roundTripMidpoint: summary?.roundTripMidpoint,
  });

  const { addedStops, addStop, clearStops, asSuggestedStops, externalStops } =
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

  const clearJournalRef = useRef<() => void>(() => {});
  const { calculateAndDiscover } = useCalculateAndDiscover({
    calculateTrip, settings, setTripConfirmed,
    refreshAdaptiveDefaults, setAdaptiveDefaults,
    clearJournal: () => clearJournalRef.current(),
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
    clearJournal: () => clearJournalRef.current(),
  });

  const { activeJournal, viewMode, startJournal, skipJournal, journalSkipped, updateActiveJournal, setViewMode, clearJournal, isJournalComplete, isLoading: isJournalLoading, showCompleteOverlay, confirmComplete, finalizeJournal, error: journalError, clearError: clearJournalError } =
    useJournal({ summary, settings, vehicle, origin: tripOrigin, defaultTitle: activeChallenge?.title });
  // Wire clearJournal into the ref so calculateAndDiscover (declared above useJournal) can call it.
  useLayoutEffect(() => { clearJournalRef.current = clearJournal; });

  const {
    validRouteGeometry, routeFeasibilityStatus,
    handleMapClick, openInGoogleMaps,
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

  const { error, clearError, copyShareLink, goToNextStep, handleResumeSession } =
    useAppCallbacks({
      calcError, journalError, clearPOIError, clearCalcError, clearJournalError,
      triggerCopyShareLink, shareUrl,
      locations,
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
    setActiveChallenge, setTripOrigin, resetPOIs, resetWizard, clearStops, clearTripCalculation, clearJournal, setCustomTitle,
    calculateAndDiscover, forceStep, markStepComplete,
  });

  // ── Voila Flow (CEO of post-calculation reveal) ───────────────────────────
  const {
    showVoila, flyoverActive, showShareScreen, triggerFlyover,
    handleShowVoila, handleFlyoverComplete, handleVoilaEdit, handleVoilaLockIn, handleViewFullDetails, handleGoHome,
    handleMinimizeToVoila, handleReturnToJournal,
    dismissVoilaCurtain,
    handleOpenShareScreen, handleCloseShareScreen,
  } = useVoilaFlow({ icebreakerOrigin, isCalculating, setTripMode, setViewMode, goToStep, forceStep, setTripConfirmed });

  // ── Icebreaker orchestrator (Four-Beat Arc + icebreaker gate + estimate workshop) ──
  const icebreaker = useIcebreakerOrchestrator({
    locations, setLocations, vehicle, setVehicle, settings, setSettings, setIcebreakerOrigin,
    markStepComplete, forceStep,
    tripMode, setTripMode, selectTripMode, setShowAdventureMode,
    calculateAndDiscover, isCalculating, summary, calcError,
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
  // When voila is still visible (lock-in curtain), start immediately —
  // the StepsBanner morph isn't visible behind voila. Otherwise 700ms
  // lets StepsBanner's wizard→trip morph play first.
  useEffect(() => {
    if (!tripConfirmed || !summary) return;
    if (isJournalComplete) return;                   // trip finished — never restart
    if (journalSkipped) { dismissVoilaCurtain(); return; }  // user opted out — still drop the curtain
    if (activeJournal) return;                       // in-progress — don't override
    if (isJournalLoading) return;                    // creation already in flight
    // Seeded title: deterministic from destination + days + travelers.
    // Falls through to generateDefaultTitle() only if both customTitle and seed fail.
    const dest = locations.find(l => l.type === 'destination')?.name?.split(',')[0].trim() ?? '';
    const title = customTitle || (dest ? buildSeededTitle({
      destination: dest,
      days: summary.drivingDays,
      travelerCount: settings.numTravelers ?? 1,
    }) : undefined);
    const delay = showVoila ? 0 : 700;
    const t = setTimeout(async () => {
      await startJournal(title ?? undefined);
      dismissVoilaCurtain();
    }, delay);
    return () => clearTimeout(t);
  }, [tripConfirmed, showVoila, activeJournal, isJournalComplete, journalSkipped, isJournalLoading, summary, startJournal, dismissVoilaCurtain, customTitle, locations, settings.numTravelers]);



  // ── Wiring (assemble what the renderer needs) ──────────────────────────
  const { board, mapProps, adventureModeProps, plannerContextValue, shareScreenProps } = useAppWiring({
    tripContext: {
      locations, setLocations, vehicle, setVehicle, settings, setSettings,
      customTitle, summary, canonicalTimeline,
    },
    tripMode: {
      tripMode, showAdventureMode, setShowAdventureMode,
      showModeSwitcher, setShowModeSwitcher, modeSwitcherRef, handleSwitchMode,
      tripActive, setTripActive,
    },
    map: {
      previewGeometry, validRouteGeometry, routeFeasibilityStatus,
      handleMapClick, adventurePreview,
    },
    wizard: {
      planningStep, completedSteps, canProceedFromStep1, canProceedFromStep2,
      goToStep, goToNextStep, goToPrevStep,
    },
    calculation: {
      isCalculating, routeStrategies, activeStrategyIndex, selectStrategy,
      strategicFuelStops, shareUrl, showOvernightPrompt, suggestedOvernightStop,
      dismissOvernightPrompt, updateStopType, calculateAndDiscover,
    },
    poi: {
      poiSuggestions, poiInference,
    },
    presets: {
      activePreset, presetOptions, handlePresetChange, handleSharePreset, shareJustCopied,
    },
    tripLoader: {
      activeChallenge, tripOrigin, templateRecommendations, pendingTemplate,
      handleImportTemplate, handleTemplateLoaded, handleDismissPendingTemplate,
      handleSelectChallenge, handleAdventureSelect, setTripMode,
    },
    journal: {
      activeJournal, viewMode, setViewMode, isJournalComplete, showCompleteOverlay,
      startJournal, skipJournal, journalSkipped, updateActiveJournal, confirmComplete, finalizeJournal, clearJournal,
    },
    session: {
      tripConfirmed, setTripConfirmed, history, hasActiveSession, lastDestination,
      resetTripSession, handleResumeSession, restoreHistoryTripSession,
      addedStopCount: addedStops.length, externalStops,
    },
    voila: {
      showVoila, flyoverActive, showShareScreen,
      handleShowVoila, handleFlyoverComplete,
      handleVoilaEdit, handleVoilaLockIn, handleViewFullDetails, handleGoHome,
      handleMinimizeToVoila, handleReturnToJournal, handleOpenShareScreen, handleCloseShareScreen,
    },
    features: { ghostCar, icebreaker },
    sys: {
      error, clearError, copyShareLink, openInGoogleMaps, calculationMessage: icebreaker.calculationMessage,
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
        adventureModeProps={adventureModeProps}
        plannerContextValue={plannerContextValue}
        shareScreenProps={shareScreenProps}
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

import { useRef, useState, useCallback, useLayoutEffect, useMemo, lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { RouteStrategyPicker } from './components/Trip/RouteStrategyPicker';
import { ErrorFallback } from './components/UI/ErrorFallback';
import { AdventureMode } from './components/Trip/Adventure/AdventureMode';
import { LandingScreen } from './components/Landing/LandingScreen';
import { useIcebreakerOrchestrator, IcebreakerOverlays } from './components/Icebreaker/IcebreakerOrchestrator';
import { PlannerFullscreenShell } from './components/App/PlannerFullscreenShell';
import { VoilaScreen } from './components/Voila/VoilaScreen';
import './styles/sidebar.css';
import { TripProvider, useTimeline, useTripCore, PlannerProvider } from './contexts';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  usePlanningStepProps, useCalculateAndDiscover, useMapProps, useGhostCar,
  useAppCallbacks, useArrivalSnap, useCalculationMessages, useBackButtonGuard,
} from './hooks';
import { useSessionLifecycle, useVoilaFlow } from './hooks/session';
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

  const { addedStops, addedPOIIds, addStop, clearStops, asSuggestedStops, mirroredReturnStops } =
    useAddedStops(summary, settings);

  // Stable reference — spread syntax creates a new array every render, which would
  // cause the rebuildCanonicalWithExternals effect to loop infinitely.
  const externalStops = useMemo(
    () => [...asSuggestedStops, ...mirroredReturnStops],
    [asSuggestedStops, mirroredReturnStops],
  );

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
    setActiveChallenge, setTripOrigin,
    handleImportTemplate, handleSelectChallenge, handleAdventureSelect,
  } = useTripLoader({
    setLocations, setVehicle, setSettings, setTripMode,
    markStepComplete, forceStep, goToStep,
    onAdventureComplete: () => setShowAdventureMode(false),
  });

  const { activeJournal, viewMode, startJournal, updateActiveJournal, setViewMode, clearJournal, isJournalComplete, showCompleteOverlay, confirmComplete, error: journalError, clearError: clearJournalError } =
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
    showVoila, flyoverActive, triggerFlyover,
    handleShowVoila, handleFlyoverComplete, handleVoilaEdit, handleVoilaLockIn, handleGoHome,
  } = useVoilaFlow({ icebreakerOrigin, isCalculating, setTripMode, goToStep, forceStep, setTripConfirmed });

  // ── Icebreaker orchestrator (Four-Beat Arc + icebreaker gate + estimate workshop) ──
  const icebreaker = useIcebreakerOrchestrator({
    locations, setLocations, vehicle, setVehicle, settings, setSettings, setIcebreakerOrigin,
    markStepComplete, forceStep,
    tripMode, setTripMode, selectTripMode, setShowAdventureMode,
    calculateAndDiscover, isCalculating, summary, calculationMessage,
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
  const handleBackPress = useCallback(() => {
    // 1. Journal active — exit to plan view
    if (activeJournal && viewMode === 'journal') { setViewMode('plan'); return; }
    // 2. Arc / icebreaker — delegate to orchestrator (it knows beat state)
    if (icebreaker.arcActive) { icebreaker.handleBack(); return; }
    // 3. Wizard steps
    if (tripMode && planningStep === 3) { goToStep(2); return; }
    if (tripMode && planningStep === 2) { goToStep(1); return; }
    // 4. Already at root — do nothing
  }, [activeJournal, viewMode, setViewMode, icebreaker, tripMode, planningStep, goToStep]);

  const backGuardActive = !!(tripMode || icebreaker.arcActive);
  useBackButtonGuard(backGuardActive, handleBackPress);



  // ── Derived props ─────────────────────────────────────────────────────────
  const mapProps = useMapProps({
    locations, validRouteGeometry, routeFeasibilityStatus,
    pois, markerCategories, tripActive, strategicFuelStops, addedPOIIds,
    mapDayOptions, handleMapClick, routeDetails: summary, handleAddPOIFromMap,
    previewGeometry, tripMode, routeStrategies, activeStrategyIndex, selectStrategy,
    units: settings.units, adventurePreview,
  });

  const canProceed = planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2;

  const stepProps = usePlanningStepProps({
    planningStep, goToStep,
    locations, setLocations, vehicle, setVehicle, settings, setSettings,
    summary, tripMode: tripMode ?? 'plan',
    setShowAdventureMode,
    handleImportTemplate, handleSelectChallenge, activeChallenge, templateRecommendations,
    activePreset, presetOptions, handlePresetChange, handleSharePreset, shareJustCopied,
    viewMode, setViewMode, activeJournal, isJournalComplete, showCompleteOverlay, startJournal, updateActiveJournal, confirmJournalComplete: confirmComplete,
    tripConfirmed, setTripConfirmed, history,
    addedStopCount: addedStops.length,
    externalStops,
    shareUrl, showOvernightPrompt, suggestedOvernightStop, dismissOvernightPrompt,
    updateStopType,
    poiSuggestions, poiInference, isLoadingPOIs, poiPartialResults, poiFetchFailed, addPOI, addStop, dismissPOI,
    openInGoogleMaps, copyShareLink,
    onLoadHistoryTrip: restoreHistoryTripSession,
    precomputedEvents: canonicalTimeline?.events,
    isCalculating,
    calculateAndDiscover,
  });

  // Stable object reference for LiveReflectionBar — avoids re-creating on every parent render.
  const liveReflection = useMemo(
    () => summary ? { summary, vehicle, settings } : null,
    [summary, vehicle, settings],
  );

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

      {/* Icebreaker overlays — Four-Beat Arc, Estimate Workshop, Icebreaker Gate */}
      <IcebreakerOverlays {...icebreaker.overlayProps} />

      {/* Screen priority: voila > planning > landing.
          Conditions are mutually exclusive — only one renders at a time. */}

      {showVoila && summary && (
        <VoilaScreen
          summary={summary}
          settings={settings}
          locations={locations}
          customTitle={customTitle}
          onEditTrip={handleVoilaEdit}
          onLockIn={handleVoilaLockIn}
          onShare={copyShareLink}
        />
      )}

      {!tripMode && !showVoila && !icebreaker.arcActive && (
        <LandingScreen
          onSelectMode={icebreaker.handleLandingSelect}
          hasSavedTrip={history.length > 0}
          onContinueSavedTrip={() => setTripMode('plan')}
          hasActiveSession={hasActiveSession}
          onResumeSession={handleResumeSession}
          lastDestination={lastDestination}
        />
      )}

      {tripMode && !showVoila && (
        <PlannerProvider value={{
          planningStep, completedSteps, canProceed,
          isCalculating,
          onStepClick: goToStep,
          onNext: goToNextStep,
          onBack: goToPrevStep,
          onReset: resetTripSession,
          tripMode,
          showModeSwitcher, setShowModeSwitcher, modeSwitcherRef,
          onSwitchMode: handleSwitchMode,
          onGoHome: handleGoHome,
          ghostCar: summary && planningStep === 3 && tripConfirmed ? ghostCar : null,
          markerCategories, loadingCategory,
          onToggleCategory: handleToggleCategory,
          error, onClearError: clearError,
          calculationMessage,
        }}>
          {/* Full-screen dark wash — same treatment as icebreaker/landing.
              Panel background is transparent on desktop; this provides the dim. */}
          <div className="absolute inset-0 pointer-events-none z-[1]" style={{ background: 'rgba(14, 11, 7, 0.72)' }} />

          <PlannerFullscreenShell
            onRevealChange={setMapRevealed}
            liveReflection={liveReflection}
            stepProps={stepProps}
          />

          {summary && planningStep === 3 && (
            <div className="hidden md:flex absolute top-4 left-0 right-0 z-20 justify-center pointer-events-none px-4">
              <RouteStrategyPicker
                strategies={routeStrategies}
                activeIndex={activeStrategyIndex}
                onSelect={selectStrategy}
                units={settings.units}
                isRoundTrip={settings.isRoundTrip}
              />
            </div>
          )}

          {summary && planningStep === 3 && (
            <div className={`absolute z-20 pointer-events-none bottom-4 left-14 right-2 md:bottom-6 md:right-6 md:left-auto md:w-[380px] ${mapRevealed ? 'flex' : 'hidden md:flex'}`}>
              <div className="pointer-events-auto w-full">
                <TripSummaryCard
                  summary={summary}
                  settings={settings}
                  tripActive={tripActive}
                  onStop={() => setTripActive(false)}
                  onOpenVehicleTab={() => goToStep(2)}
                />
              </div>
            </div>
          )}

          {showAdventureMode && (
            <AdventureMode
              origin={locations.find(l => l.type === 'origin') || null}
              initialValues={icebreaker.adventureInitialValues ?? undefined}
              onOriginChange={(newOrigin) => {
                setLocations(prev => prev.map(loc => loc.type === 'origin' ? { ...loc, ...newOrigin } : loc));
              }}
              onSelectDestination={handleAdventureSelect}
              onSelectChallenge={(challenge) => { handleSelectChallenge(challenge); setShowAdventureMode(false); }}
              onClose={() => setShowAdventureMode(false)}
              fuelCostPerKm={(getWeightedFuelEconomyL100km(vehicle, settings.units) / 100) * settings.gasPrice}
            />
          )}
        </PlannerProvider>
      )}
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

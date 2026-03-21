import { useRef, useState, useCallback, useLayoutEffect, useEffect, useMemo, lazy, Suspense } from 'react';
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
import { TripProvider, useTimeline, useTripCore } from './contexts';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  usePlanningStepProps, useAppReset, useCalculateAndDiscover, useMapProps, useGhostCar,
  useAppCallbacks, useTripRestore,
} from './hooks';
import { useArrivalSnap } from './hooks/useArrivalSnap';
import { useCalculationMessages } from './hooks/useCalculationMessages';
import { useBackButtonGuard } from './hooks/useBackButtonGuard';
import { getHistory, saveActiveSession } from './lib/storage';
import { getWeightedFuelEconomyL100km } from './lib/unit-conversions';
import type { HistoryTripSnapshot } from './types';

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
  const [history] = useState<HistoryTripSnapshot[]>(() => getHistory());
  const [adventurePreview, setAdventurePreview] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);
  const [showVoila, setShowVoila] = useState(false);
  const [flyoverActive, setFlyoverActive] = useState(false);

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

  // ── L2: Calculation ───────────────────────────────────────────────────────
  const {
    isCalculating, error: calcError, shareUrl,
    strategicFuelStops, showOvernightPrompt, suggestedOvernightStop,
    dismissOvernightPrompt, calculateTrip,
    routeStrategies, activeStrategyIndex, selectStrategy,
    updateStopType,
    rebuildCanonicalWithExternals,
    clearError: clearCalcError, clearTripCalculation,
  } = useTripCalculation({
    locations, vehicle, settings,
    onCalculationComplete: () => onCalcCompleteRef.current(),
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

  useLayoutEffect(() => {
    onCalcCompleteRef.current = () => {
      if (icebreaker.onCalcComplete()) return;
      // Classic wizard path: trigger Flyover → VoilaScreen
      markStepComplete(1); markStepComplete(2);
      setFlyoverActive(true);
    };
  });
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

  // Keep canonical timeline in sync with user-added POI stops so print output
  // matches the itinerary. Fires synchronously (no network) on each add/remove.
  useEffect(() => {
    if (!summary) return;
    rebuildCanonicalWithExternals([...asSuggestedStops, ...mirroredReturnStops]);
  // Intentional dep omission — this is load-bearing, not lazy:
  //   • `summary` is excluded because including it would re-trigger the rebuild
  //     on every route recalculation, creating a feedback loop.
  //   • We only want to rebuild when the *external stops list* changes.
  //   • `rebuildCanonicalWithExternals` is a stable useCallback ref — safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asSuggestedStops, mirroredReturnStops]);

  // ── Session / lifecycle ───────────────────────────────────────────────────
  const { resetTripSession, selectTripMode } = useAppReset({
    setLocations, resetPOIs, resetWizard, clearStops, clearTripCalculation,
    setActiveChallenge, setTripOrigin, setTripConfirmed, setTripMode, setShowAdventureMode,
    clearJournal,
  });

  const { restoreHistoryTripSession } = useTripRestore({
    setLocations,
    setSettings,
    setTripConfirmed,
    setTripMode,
    calculateAndDiscover,
    forceStep,
    markStepComplete,
  });

  const calculationMessage = useCalculationMessages(isCalculating, locations, icebreakerOrigin);

  // ── VoilaScreen callbacks ─────────────────────────────────────────────────
  const handleShowVoila = useCallback(() => setShowVoila(true), []);

  const handleFlyoverComplete = useCallback(() => {
    setFlyoverActive(false);
    setShowVoila(true);
  }, []);

  const handleVoilaEdit = useCallback(() => {
    setShowVoila(false);
    setTripConfirmed(false); // trip is no longer confirmed — prevents ghost car re-activating during edit
    if (icebreakerOrigin) setTripMode('plan');
    goToStep(2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icebreakerOrigin, setTripMode, setTripConfirmed]);

  const handleGoHome = useCallback(() => {
    if (isCalculating) return;
    setTripMode(null);
    setShowVoila(false);
  }, [isCalculating, setTripMode]);

  const handleVoilaLockIn = useCallback(() => {
    setTripConfirmed(true);
    setShowVoila(false);
    if (icebreakerOrigin) setTripMode('plan');
    forceStep(3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icebreakerOrigin, setTripMode, forceStep, setTripConfirmed]);

  // ── Icebreaker orchestrator (Four-Beat Arc + icebreaker gate + estimate workshop) ──
  const icebreaker = useIcebreakerOrchestrator({
    locations, setLocations, vehicle, setVehicle, settings, setSettings, setIcebreakerOrigin,
    markStepComplete, forceStep,
    tripMode, setTripMode, selectTripMode, setShowAdventureMode,
    calculateAndDiscover, isCalculating, summary, calculationMessage,
    setAdventurePreview, onShowVoila: handleShowVoila,
    customTitle, setCustomTitle,
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

  // Save active session to localStorage whenever the trip is confirmed and locations are valid.
  // Cleared automatically by resetTripSession (Plan New Trip).
  useEffect(() => {
    if (!tripConfirmed || !locations.some(l => l.lat !== 0)) return;
    saveActiveSession(locations, settings);
  }, [tripConfirmed, locations, settings]);

  const hasActiveSession = locations.some(loc => loc.name && loc.name.trim() !== '');
  const lastDestination = (() => {
    const locs = history[0]?.locations;
    return locs && locs.length > 0 ? locs[locs.length - 1].name : undefined;
  })();

  // ── Derived props ─────────────────────────────────────────────────────────
  const mapProps = useMapProps({
    locations, validRouteGeometry, routeFeasibilityStatus,
    pois, markerCategories, tripActive, strategicFuelStops, addedPOIIds,
    mapDayOptions, handleMapClick, routeDetails: summary, handleAddPOIFromMap,
    previewGeometry, tripMode, routeStrategies, activeStrategyIndex, selectStrategy,
    units: settings.units, adventurePreview,
  });

  const canProceed = planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2;

  // TunePanel: apply settings patch and recalculate
  const handleTune = useCallback((patch: Partial<typeof settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setTimeout(() => calculateAndDiscover(), 0);
  }, [setSettings, calculateAndDiscover]);

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
    externalStops: [...asSuggestedStops, ...mirroredReturnStops],
    shareUrl, showOvernightPrompt, suggestedOvernightStop, dismissOvernightPrompt,
    updateStopType,
    poiSuggestions, poiInference, isLoadingPOIs, poiPartialResults, poiFetchFailed, addPOI, addStop, dismissPOI,
    openInGoogleMaps, copyShareLink,
    onLoadHistoryTrip: restoreHistoryTripSession,
    precomputedEvents: canonicalTimeline?.events,
    isCalculating,
    onTune: handleTune,
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
        <>
          {/* Full-screen dark wash — same treatment as icebreaker/landing.
              Panel background is transparent on desktop; this provides the dim. */}
          <div className="absolute inset-0 pointer-events-none z-[1]" style={{ background: 'rgba(14, 11, 7, 0.72)' }} />

          <PlannerFullscreenShell
            tripMode={tripMode}
            onRevealChange={setMapRevealed}
            planningStep={planningStep}
            completedSteps={completedSteps}
            isCalculating={isCalculating}
            onStepClick={goToStep}
            showModeSwitcher={showModeSwitcher}
            setShowModeSwitcher={setShowModeSwitcher}
            modeSwitcherRef={modeSwitcherRef}
            onSwitchMode={handleSwitchMode}
            ghostCar={summary && planningStep === 3 && tripConfirmed ? ghostCar : null}
            canProceed={canProceed}
            onNext={goToNextStep}
            onBack={goToPrevStep}
            onReset={resetTripSession}
            onGoHome={handleGoHome}
            markerCategories={markerCategories}
            loadingCategory={loadingCategory}
            onToggleCategory={handleToggleCategory}
            error={error}
            onClearError={clearError}
            calculationMessage={calculationMessage}
            stepProps={stepProps}
            liveReflection={liveReflection}
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
        </>
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

import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { Map } from './components/Map/Map';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { RouteStrategyPicker } from './components/Trip/RouteStrategyPicker';
import { AdventureMode } from './components/Trip/Adventure/AdventureMode';
import { LandingScreen } from './components/Landing/LandingScreen';
import { PlannerSidebarShell } from './components/App/PlannerSidebarShell';
import './styles/sidebar.css';
import { TripProvider, useTimeline, useTripCore } from './contexts';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  usePlanningStepProps, useAppReset, useCalculateAndDiscover, useMapProps, useGhostCar,
  useAppCallbacks, useTripRestore,
} from './hooks';
import { useArrivalSnap } from './hooks/useArrivalSnap';
import { getHistory } from './lib/storage';
import { getWeightedFuelEconomyL100km } from './lib/unit-conversions';
import type { HistoryTripSnapshot } from './types';

/** App.tsx — Root orchestrator. Full-bleed map + floating glass panel. 💚 My Experience Engine */
function AppContent() {
  const { locations, setLocations, vehicle, setVehicle, settings, setSettings } = useTripCore();
  const { summary, canonicalTimeline } = useTimeline();

  const previewGeometry = useEagerRoute(locations);
  const onCalcCompleteRef = useRef<() => void>(() => {});
  const [tripConfirmed, setTripConfirmed] = useState(false);
  const [mapRevealed, setMapRevealed] = useState(false);
  const [history] = useState<HistoryTripSnapshot[]>(() => getHistory());

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
    fetchRoutePOIs, clearError: clearPOIError, resetPOIs,
  } = usePOI();

  const { addedStops, addedPOIIds, addStop, clearStops, asSuggestedStops, mirroredReturnStops } =
    useAddedStops(summary, settings.isRoundTrip);

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
    calculateTrip, locations, settings, setTripConfirmed,
    fetchRoutePOIs, refreshAdaptiveDefaults, setAdaptiveDefaults,
  });

  const {
    planningStep, completedSteps, canProceedFromStep1, canProceedFromStep2,
    goToNextStep: wizardNext, goToPrevStep, goToStep, forceStep,
    markStepComplete, resetWizard,
  } = useWizard({ locations, vehicle, onCalculate: calculateAndDiscover });

  useLayoutEffect(() => {
    onCalcCompleteRef.current = () => {
      markStepComplete(1); markStepComplete(2); markStepComplete(3); forceStep(3);
    };
  });
  const {
    activeChallenge, tripOrigin,
    setActiveChallenge, setTripOrigin,
    handleImportTemplate, handleSelectChallenge, handleAdventureSelect,
  } = useTripLoader({
    setLocations, setVehicle, setSettings,
    markStepComplete, forceStep, goToStep,
    onAdventureComplete: () => setShowAdventureMode(false),
  });

  const { activeJournal, viewMode, startJournal, updateActiveJournal, setViewMode, error: journalError, clearError: clearJournalError } =
    useJournal({ summary, settings, vehicle, origin: tripOrigin, defaultTitle: activeChallenge?.title });

  const {
    validRouteGeometry, routeFeasibilityStatus, mapDayOptions,
    handleMapClick, handleAddPOIFromMap, openInGoogleMaps,
    copyShareLink: triggerCopyShareLink,
  } = useMapInteractions({ locations, setLocations, summary, settings, addStop });

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

  const ghostCar = useGhostCar(canonicalTimeline, summary, settings, asSuggestedStops);
  useArrivalSnap(ghostCar.anchorAt, !!summary && tripConfirmed);

  // Keep canonical timeline in sync with user-added POI stops so print output
  // matches the itinerary. Fires synchronously (no network) on each add/remove.
  useEffect(() => {
    if (!summary) return;
    rebuildCanonicalWithExternals([...asSuggestedStops, ...mirroredReturnStops]);
  // rebuildCanonicalWithExternals is stable (useCallback); summary guards the
  // rebuild but isn't a dep because we only want to re-run on stop changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asSuggestedStops, mirroredReturnStops]);

  const { resetTripSession, selectTripMode } = useAppReset({
    setLocations, resetPOIs, resetWizard, clearStops, clearTripCalculation,
    setActiveChallenge, setTripOrigin, setTripConfirmed, setTripMode, setShowAdventureMode,
  });

  const { restoreHistoryTripSession } = useTripRestore({
    setLocations,
    calculateAndDiscover,
    forceStep,
    markStepComplete,
  });

  const hasActiveSession = locations.some(loc => loc.name && loc.name.trim() !== '');
  const lastDestination = (() => {
    const locs = history[0]?.locations;
    return locs && locs.length > 0 ? locs[locs.length - 1].name : undefined;
  })();

  const mapProps = useMapProps({
    locations, validRouteGeometry, routeFeasibilityStatus,
    pois, markerCategories, tripActive, strategicFuelStops, addedPOIIds,
    mapDayOptions, handleMapClick, summary, handleAddPOIFromMap,
    previewGeometry, tripMode, routeStrategies, activeStrategyIndex, selectStrategy,
    units: settings.units,
  });

  const canProceed = planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2;

  const stepProps = usePlanningStepProps({
    planningStep, goToStep,
    locations, setLocations, vehicle, setVehicle, settings, setSettings,
    summary, tripMode: tripMode ?? 'plan',
    setShowAdventureMode,
    handleImportTemplate, handleSelectChallenge, activeChallenge,
    activePreset, presetOptions, handlePresetChange, handleSharePreset, shareJustCopied,
    viewMode, setViewMode, activeJournal, startJournal, updateActiveJournal,
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
  });

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <Map {...mapProps} />
      </div>

      {!tripMode && (
        <LandingScreen
          onSelectMode={selectTripMode}
          hasSavedTrip={history.length > 0}
          onContinueSavedTrip={() => setTripMode('plan')}
          hasActiveSession={hasActiveSession}
          onResumeSession={handleResumeSession}
          lastDestination={lastDestination}
        />
      )}

      {tripMode && (
        <>
          <div className="mee-vignette absolute inset-0 pointer-events-none z-[1]" />

          <PlannerSidebarShell
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
            markerCategories={markerCategories}
            loadingCategory={loadingCategory}
            onToggleCategory={handleToggleCategory}
            error={error}
            onClearError={clearError}
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
              onOriginChange={(newOrigin) => {
                setLocations(prev => prev.map(loc => loc.type === 'origin' ? { ...loc, ...newOrigin } : loc));
              }}
              onSelectDestination={handleAdventureSelect}
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

import { useRef, useState, useLayoutEffect } from 'react';
import { StepsBanner } from './components/StepsBanner';
import { WizardContent } from './components/WizardContent';
import { Map } from './components/Map/Map';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { RouteStrategyPicker } from './components/Trip/RouteStrategyPicker';
import { AdventureMode } from './components/Trip/AdventureMode';
import { LandingScreen } from './components/Landing/LandingScreen';
import { PlanningStepContent } from './components/Steps/PlanningStepContent';
import { SwipeableWizard } from './components/UI/SwipeableWizard';
import './styles/sidebar.css';
import { TripProvider, useTripContext } from './contexts';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  usePlanningStepProps, useAppReset, useCalculateAndDiscover, useMapProps, useGhostCar,
  useAppCallbacks,
} from './hooks';
import { useArrivalSnap } from './hooks/useArrivalSnap';
import { getHistory } from './lib/storage';
import { getWeightedFuelEconomyL100km } from './lib/unit-conversions';
import type { TripSummary } from './types';

/** App.tsx — Root orchestrator. Full-bleed map + floating glass panel. 💚 My Experience Engine */
function AppContent() {
  const { locations, setLocations, vehicle, setVehicle, settings, setSettings, summary, setSummary } = useTripContext();

  const previewGeometry = useEagerRoute(locations);
  const onCalcCompleteRef = useRef<() => void>(() => {});
  const [tripConfirmed, setTripConfirmed] = useState(false);
  const [mapRevealed, setMapRevealed] = useState(false);
  const [history] = useState<TripSummary[]>(() => getHistory());

  // Mode management (plan/adventure/estimate)
  const {
    tripMode, setTripMode,
    showAdventureMode, setShowAdventureMode,
    showModeSwitcher, setShowModeSwitcher,
    modeSwitcherRef,
    tripActive, setTripActive,
    handleSwitchMode,
  } = useTripMode();

  // Style preset (travel style / hotel+meal defaults)
  const {
    activePreset, presetOptions, shareJustCopied,
    handlePresetChange, handleSharePreset,
    setAdaptiveDefaults, refreshAdaptiveDefaults,
  } = useStylePreset({ setSettings });

  // POI system
  const {
    pois, markerCategories, loadingCategory, poiSuggestions, poiInference, isLoadingPOIs,
    poiPartialResults,
    error: poiError, toggleCategory, addPOI, dismissPOI,
    fetchRoutePOIs, clearError: clearPOIError, resetPOIs,
  } = usePOI();

  // Map-click added stops + return-leg mirroring
  const { addedStops, addedPOIIds, addStop, clearStops, asSuggestedStops, mirroredReturnStops } =
    useAddedStops(summary, settings.isRoundTrip);

  // ─── Layer 2: Calculation & Navigation ───────────────────────────────────────

  // Trip calculation
  const {
    isCalculating, error: calcError, shareUrl, canonicalTimeline,
    strategicFuelStops, showOvernightPrompt, suggestedOvernightStop,
    dismissOvernightPrompt, calculateTrip,
    routeStrategies, activeStrategyIndex, selectStrategy,
    updateStopType, updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight,
    clearError: clearCalcError, clearTripCalculation,
  } = useTripCalculation({
    locations, vehicle, settings,
    onSummaryChange: setSummary,
    onCalculationComplete: () => onCalcCompleteRef.current(),
  });

  const { calculateAndDiscover } = useCalculateAndDiscover({
    calculateTrip, locations, settings, setTripConfirmed,
    fetchRoutePOIs, refreshAdaptiveDefaults, setAdaptiveDefaults,
  });

  // Wizard (step navigation)
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

  // ─── Layer 3: Dependent on Calculation Results ──────────────────────────────

  // Trip loader (templates, challenges, adventure mode)
  const {
    activeChallenge, tripOrigin,
    setActiveChallenge, setTripOrigin,
    handleImportTemplate, handleSelectChallenge, handleAdventureSelect,
  } = useTripLoader({
    setLocations, setVehicle, setSettings,
    markStepComplete, forceStep, goToStep,
    onAdventureComplete: () => setShowAdventureMode(false),
  });

  // Journal
  const { activeJournal, viewMode, startJournal, updateActiveJournal, setViewMode } =
    useJournal({ summary, settings, vehicle, origin: tripOrigin, defaultTitle: activeChallenge?.title });

  // Map interactions (geometry, feasibility, click handlers)
  const {
    validRouteGeometry, routeFeasibilityStatus, mapDayOptions,
    handleMapClick, handleAddPOIFromMap, openInGoogleMaps,
    copyShareLink: triggerCopyShareLink,
  } = useMapInteractions({ locations, setLocations, summary, settings, addStop });

  // URL hydration (mount load, origin persist, arrive-by recalc)
  useURLHydration({
    setLocations, setVehicle, setSettings,
    locations, settings, summary,
    markStepComplete, forceStep,
    setAdaptiveDefaults,
  });

  const { error, clearError, copyShareLink, handleToggleCategory, goToNextStep, handleResumeSession } =
    useAppCallbacks({
      poiError, calcError, clearPOIError, clearCalcError,
      triggerCopyShareLink, shareUrl,
      locations, toggleCategory, validRouteGeometry,
      planningStep, calculateAndDiscover, wizardNext,
      setTripMode,
    });

  // Ghost car — time-based trip progress simulation
  const ghostCar = useGhostCar(canonicalTimeline, summary, settings, asSuggestedStops);
  // Arrival snap — re-anchors ghost car when journal 'Arrived' is tapped
  useArrivalSnap(ghostCar.anchorAt, !!summary && tripConfirmed);

  const { resetTrip, handleSelectMode } = useAppReset({
    setLocations, setSummary, resetPOIs, resetWizard, clearStops, clearTripCalculation,
    setActiveChallenge, setTripOrigin, setTripConfirmed, setTripMode, setShowAdventureMode,
  });

  // ==================== RENDER ====================

  const hasActiveSession = locations.some(loc => loc.name && loc.name.trim() !== '');
  const lastDestination = (() => {
    const segs = history[0]?.segments;
    return segs && segs.length > 0 ? segs[segs.length - 1].to.name : undefined;
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
    summary, setSummary, tripMode: tripMode ?? 'plan',
    setShowAdventureMode,
    handleImportTemplate, handleSelectChallenge, activeChallenge,
    activePreset, presetOptions, handlePresetChange, handleSharePreset, shareJustCopied,
    viewMode, setViewMode, activeJournal, startJournal, updateActiveJournal,
    tripConfirmed, setTripConfirmed, history,
    addedStopCount: addedStops.length,
    externalStops: [...asSuggestedStops, ...mirroredReturnStops],
    shareUrl, showOvernightPrompt, suggestedOvernightStop, dismissOvernightPrompt,
    updateStopType, updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight,
    poiSuggestions, poiInference, isLoadingPOIs, poiPartialResults, addPOI, addStop, dismissPOI,
    openInGoogleMaps, copyShareLink,
    precomputedEvents: canonicalTimeline?.events,
    canonicalTimeline,
  });

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">

      {/* ── Full-bleed map — always mounted (landing floats above it) ── */}
      <div className="absolute inset-0">
        <Map {...mapProps} />
      </div>

      {/* ── Landing overlay — floats over map when no trip mode selected ── */}
      {!tripMode && (
        <LandingScreen
          onSelectMode={handleSelectMode}
          hasSavedTrip={history.length > 0}
          onContinueSavedTrip={() => setTripMode('plan')}
          hasActiveSession={hasActiveSession}
          onResumeSession={handleResumeSession}
          lastDestination={lastDestination}
        />
      )}

      {/* ── Planner UI — only when a trip mode is active ── */}
      {tripMode && (
        <>
          {/* Vignette overlay (left opaque → right transparent) */}
          <div className="mee-vignette absolute inset-0 pointer-events-none z-[1]" />

          <div className="absolute inset-0 z-20 md:inset-auto md:left-6 md:top-6 md:bottom-6 md:w-[420px] pointer-events-none">
            {/* Floating glass panel via SwipeableWizard */}
            <SwipeableWizard tripMode={tripMode} onRevealChange={setMapRevealed}>
              <div className="sidebar-dark mee-panel w-full h-full flex flex-col pointer-events-auto md:rounded-[20px]">
              <StepsBanner
                currentStep={planningStep}
                completedSteps={completedSteps}
                tripMode={tripMode}
                isCalculating={isCalculating}
                onStepClick={goToStep}
                showModeSwitcher={showModeSwitcher}
                setShowModeSwitcher={setShowModeSwitcher}
                modeSwitcherRef={modeSwitcherRef}
                onSwitchMode={handleSwitchMode}
                ghostCar={summary && planningStep === 3 && tripConfirmed ? ghostCar : null}
              />
              <WizardContent
                planningStep={planningStep}
                canProceed={canProceed}
                isCalculating={isCalculating}
                onNext={goToNextStep}
                onBack={goToPrevStep}
                onReset={resetTrip}
                tripMode={tripMode}
                markerCategories={markerCategories}
                loadingCategory={loadingCategory}
                onToggleCategory={handleToggleCategory}
                error={error}
                onClearError={clearError}
              >
                {tripMode && <PlanningStepContent {...stepProps} />}
              </WizardContent>
              </div>
            </SwipeableWizard>
          </div>

          {/* Route strategy pills — fixed at top-center of map */}
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

          {/* Trip summary card — bottom-right on desktop; bottom of map on mobile when revealed */}
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

          {/* Adventure mode modal */}
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

// ==================== APP WRAPPER ====================

function App() {
  return (
    <TripProvider>
      <AppContent />
    </TripProvider>
  );
}

export default App;

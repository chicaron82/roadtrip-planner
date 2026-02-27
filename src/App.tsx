import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { StepsBanner } from './components/StepsBanner';
import { WizardContent } from './components/WizardContent';
import { Map } from './components/Map/Map';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { RouteStrategyPicker } from './components/Trip/RouteStrategyPicker';
import { AdventureMode } from './components/Trip/AdventureMode';
import { LandingScreen } from './components/Landing/LandingScreen';
import { PlanningStepContent } from './components/Steps/PlanningStepContent';
import './styles/sidebar.css';
import { TripProvider, useTripContext, DEFAULT_LOCATIONS } from './contexts';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  type PlanningStep,
} from './hooks';
import { recordTrip } from './lib/user-profile';
import { getHistory, getLastOrigin } from './lib/storage';
import type { TripSummary, TripMode, POICategory } from './types';

/**
 * App.tsx — Immersive Map Layout (MEE Redesign)
 *
 * Layout: full-bleed Map behind floating glass panel (portrait + desktop)
 * Panel: StepsBanner → WizardContent scrollable form
 *
 * HOOK DEPENDENCY FLOW:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  TripContext (locations, vehicle, settings, summary)                        │
 * │       ↓ consumed by all hooks                                               │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  LAYER 1: Independent hooks (no cross-hook deps)                            │
 * │    • useTripMode        — plan/adventure/estimate mode state                │
 * │    • useStylePreset     — travel style presets (Road Warrior, etc.)         │
 * │    • usePOI             — POI discovery + category toggles                  │
 * │    • useEagerRoute      — dashed preview line before calculation            │
 * │    • useAddedStops      — map-click waypoints + round-trip mirroring        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  LAYER 2: Hooks that depend on Layer 1 outputs                              │
 * │    • useTripCalculation — route calc, fuel stops, strategies                │
 * │    • useWizard          — step navigation (1→2→3)                           │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  LAYER 3: Hooks that depend on Layer 2 outputs                              │
 * │    • useTripLoader      — template/challenge loading                        │
 * │    • useJournal         — journal sessions                                  │
 * │    • useMapInteractions — geometry + click handlers                         │
 * │    • useURLHydration    — URL state restore                                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * 💚 My Experience Engine
 */

// ==================== APP CONTENT (uses hooks) ====================

function AppContent() {
  // ─── TripContext (global state) ─────────────────────────────────────────────
  const { locations, setLocations, vehicle, setVehicle, settings, setSettings, summary, setSummary } = useTripContext();

  // ─── Layer 1: Independent Hooks ─────────────────────────────────────────────
  const previewGeometry = useEagerRoute(locations);

  // ─── Refs (cross-hook coordination) ──────────────────────────────────────────
  const onCalcCompleteRef = useRef<() => void>(() => {});
  const settingsRef = useRef(settings);

  // ─── Local UI State ─────────────────────────────────────────────────────────
  const [tripConfirmed, setTripConfirmed] = useState(false);
  const [history] = useState<TripSummary[]>(() => getHistory());

  // Mode management (plan/adventure/estimate)
  const {
    tripMode, setTripMode,
    showAdventureMode, setShowAdventureMode,
    showModeSwitcher, setShowModeSwitcher,
    modeSwitcherRef,
    tripActive, setTripActive,
  } = useTripMode();

  // Style preset (travel style / hotel+meal defaults)
  const {
    activePreset, presetOptions, shareJustCopied,
    handlePresetChange, handleSharePreset,
    setAdaptiveDefaults, refreshAdaptiveDefaults,
  } = useStylePreset({ setSettings });

  // POI system
  const {
    pois, markerCategories, loadingCategory, poiSuggestions, isLoadingPOIs,
    error: poiError, toggleCategory, addPOI, dismissPOI,
    fetchRoutePOIs, clearError: clearPOIError, resetPOIs,
  } = usePOI();

  // Map-click added stops + return-leg mirroring
  const { addedStops, addedPOIIds, addStop, clearStops, asSuggestedStops, mirroredReturnStops } =
    useAddedStops(summary, settings.isRoundTrip);

  // ─── Layer 2: Calculation & Navigation ───────────────────────────────────────

  // POI add — marks suggestion as added AND inserts it as a route waypoint
  const handleAddPOI = useCallback((poiId: string) => {
    addPOI(poiId);
    const poi = poiSuggestions.find(p => p.id === poiId);
    if (poi) {
      const categoryMap: Partial<Record<string, POICategory>> = {
        gas: 'gas', food: 'food', restaurant: 'food', cafe: 'food', hotel: 'hotel', attraction: 'attraction',
      };
      addStop(
        { id: poi.id, name: poi.name, lat: poi.lat, lng: poi.lng, address: poi.address, category: categoryMap[poi.category] ?? 'attraction' },
        summary?.segments ?? []
      );
    }
  }, [addPOI, poiSuggestions, addStop, summary]);

  // Trip calculation
  const {
    isCalculating, error: calcError, shareUrl,
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

  // Calculate trip + fetch POIs together
  const calculateAndDiscover = useCallback(async () => {
    setTripConfirmed(false);
    const tripResult = await calculateTrip();
    if (!tripResult) return;
    recordTrip(settingsRef.current);
    setAdaptiveDefaults(refreshAdaptiveDefaults());
    const origin = locations.find(l => l.type === 'origin');
    const destination = locations.find(l => l.type === 'destination');
    if (origin && destination && tripResult.fullGeometry) {
      fetchRoutePOIs(
        tripResult.fullGeometry as [number, number][],
        origin, destination,
        settings.tripPreferences,
        tripResult.segments,
      );
    }
  }, [calculateTrip, locations, settings.tripPreferences, fetchRoutePOIs, refreshAdaptiveDefaults, setAdaptiveDefaults]);

  // Wizard (step navigation)
  const {
    planningStep, completedSteps, canProceedFromStep1, canProceedFromStep2,
    goToNextStep: wizardNext, goToPrevStep, goToStep, forceStep,
    markStepComplete, resetWizard,
  } = useWizard({ locations, vehicle, onCalculate: calculateAndDiscover });

  // Keep refs current
  useLayoutEffect(() => {
    settingsRef.current = settings;
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

  // ==================== DERIVED / LOCAL CALLBACKS ====================

  const error = poiError || calcError;
  const clearError = useCallback(() => { clearPOIError(); clearCalcError(); }, [clearPOIError, clearCalcError]);
  const copyShareLink = useCallback(() => triggerCopyShareLink(shareUrl), [triggerCopyShareLink, shareUrl]);

  const handleToggleCategory = useCallback((id: POICategory) => {
    const loc = locations.find(l => l.type === 'destination' && l.lat !== 0) || locations[0];
    toggleCategory(id, loc.lat !== 0 ? loc : null, validRouteGeometry);
  }, [locations, toggleCategory, validRouteGeometry]);

  const goToNextStep = useCallback(() => {
    if (planningStep === 2) calculateAndDiscover(); else wizardNext();
  }, [planningStep, calculateAndDiscover, wizardNext]);

  const handleStepClick = useCallback((step: PlanningStep) => goToStep(step), [goToStep]);

  const handleSwitchMode = useCallback((mode: TripMode) => {
    if (mode === 'adventure') { setTripMode('adventure'); setShowAdventureMode(true); }
    else setTripMode(mode);
  }, [setTripMode, setShowAdventureMode]);

  const resetTrip = useCallback(() => {
    setLocations(DEFAULT_LOCATIONS); setSummary(null);
    resetPOIs(); resetWizard(); clearStops(); clearTripCalculation();
    setActiveChallenge(null); setTripOrigin(null); setTripConfirmed(false);
  }, [setLocations, setSummary, resetWizard, resetPOIs, clearStops, clearTripCalculation, setActiveChallenge, setTripOrigin]);

  const handleSelectMode = useCallback((mode: TripMode) => {
    resetTrip();
    window.history.replaceState({}, '', window.location.pathname);
    resetWizard(); setTripMode(mode);
    if (mode === 'adventure') setShowAdventureMode(true);
    const lastOrigin = getLastOrigin();
    if (lastOrigin) {
      setLocations(prev =>
        prev.map((loc, i) => i === 0 ? { ...lastOrigin, id: loc.id, type: 'origin' } : loc)
      );
    }
  }, [resetTrip, resetWizard, setTripMode, setShowAdventureMode, setLocations]);

  const handleResumeSession = useCallback(() => {
    setTripMode('plan');
    if (planningStep === 3 && locations.length >= 2) calculateAndDiscover();
  }, [setTripMode, planningStep, locations.length, calculateAndDiscover]);

  // ==================== RENDER ====================

  const hasActiveSession = locations.some(loc => loc.name && loc.name.trim() !== '');

  if (!tripMode) {
    return (
      <LandingScreen
        onSelectMode={handleSelectMode}
        hasSavedTrip={history.length > 0}
        onContinueSavedTrip={() => setTripMode('plan')}
        hasActiveSession={hasActiveSession}
        onResumeSession={handleResumeSession}
      />
    );
  }

  const stepContent = (
    <PlanningStepContent
      planningStep={planningStep}
      locations={locations} setLocations={setLocations}
      vehicle={vehicle} setVehicle={setVehicle}
      settings={settings} setSettings={setSettings}
      summary={summary} tripMode={tripMode}
      onShowAdventure={() => setShowAdventureMode(true)}
      onImportTemplate={handleImportTemplate}
      onSelectChallenge={handleSelectChallenge}
      activePreset={activePreset} presetOptions={presetOptions}
      onPresetChange={handlePresetChange}
      onSharePreset={handleSharePreset}
      shareJustCopied={shareJustCopied}
      viewMode={viewMode} setViewMode={setViewMode}
      activeJournal={activeJournal} activeChallenge={activeChallenge}
      tripConfirmed={tripConfirmed} addedStopCount={addedStops.length}
      externalStops={[...asSuggestedStops, ...mirroredReturnStops]}
      history={history} shareUrl={shareUrl}
      showOvernightPrompt={showOvernightPrompt}
      suggestedOvernightStop={suggestedOvernightStop}
      poiSuggestions={poiSuggestions} isLoadingPOIs={isLoadingPOIs}
      onDismissOvernight={dismissOvernightPrompt}
      onUpdateStopType={updateStopType}
      onUpdateDayNotes={updateDayNotes}
      onUpdateDayTitle={updateDayTitle}
      onUpdateDayType={updateDayType}
      onUpdateOvernight={updateDayOvernight}
      onAddPOI={handleAddPOI} onDismissPOI={dismissPOI}
      onOpenGoogleMaps={openInGoogleMaps}
      onCopyShareLink={copyShareLink}
      onStartJournal={startJournal}
      onUpdateJournal={updateActiveJournal}
      onGoToStep={goToStep}
      onConfirmTrip={() => setTripConfirmed(true)}
      onUnconfirmTrip={() => { setTripConfirmed(false); setViewMode('plan'); }}
      onLoadHistoryTrip={setSummary}
    />
  );

  const canProceed = planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2;

  // Shared map props — used by both CompactMap (mobile) and Map (desktop)
  const mapProps = {
    locations,
    routeGeometry: validRouteGeometry,
    feasibilityStatus: routeFeasibilityStatus,
    pois,
    markerCategories,
    tripActive,
    strategicFuelStops,
    addedPOIIds,
    dayOptions: mapDayOptions,
    onMapClick: handleMapClick,
    onAddPOI: summary ? handleAddPOIFromMap : undefined,
    previewGeometry: validRouteGeometry ? null : previewGeometry,
    tripMode,
    alternateGeometries: routeStrategies
      .filter((_, i) => i !== activeStrategyIndex)
      .map((s) => ({
        geometry: s.geometry,
        label: s.label,
        emoji: s.emoji,
        onSelect: () => selectStrategy(routeStrategies.indexOf(s)),
      })),
    tripDays: summary?.days,
    routeSegments: summary?.segments,
  } as const;

  return (
    <div className="relative h-screen w-full overflow-hidden">

      {/* ── Full-bleed map — always visible behind panel ── */}
      <div className="absolute inset-0">
        <Map {...mapProps} />
      </div>

      {/* ── Vignette overlay (left opaque → right transparent) ── */}
      <div className="mee-vignette absolute inset-0 pointer-events-none z-[1]" />

      {/* ── Floating glass panel ── */}
      <div className="sidebar-dark mee-panel absolute inset-0 z-10 w-full flex flex-col overflow-hidden md:inset-auto md:left-6 md:top-6 md:bottom-6 md:w-[420px]">
        <StepsBanner
          currentStep={planningStep}
          completedSteps={completedSteps}
          tripMode={tripMode}
          isCalculating={isCalculating}
          onStepClick={handleStepClick}
          showModeSwitcher={showModeSwitcher}
          setShowModeSwitcher={setShowModeSwitcher}
          modeSwitcherRef={modeSwitcherRef}
          onSwitchMode={handleSwitchMode}
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
          {stepContent}
        </WizardContent>
      </div>

      {/* ── Desktop overlays (route strategy + trip summary) ── */}
      {summary && planningStep === 3 && (
        <div className="hidden md:flex absolute bottom-6 right-6 z-20 flex-col gap-3 pointer-events-none">
          <div className="pointer-events-auto">
            <RouteStrategyPicker
              strategies={routeStrategies}
              activeIndex={activeStrategyIndex}
              onSelect={selectStrategy}
              units={settings.units}
              isRoundTrip={settings.isRoundTrip}
            />
          </div>
          <div className="pointer-events-auto">
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

      {/* ── Adventure mode modal ── */}
      {showAdventureMode && (
        <AdventureMode
          origin={locations.find(l => l.type === 'origin') || null}
          onOriginChange={(newOrigin) => {
            setLocations(prev => prev.map(loc => loc.type === 'origin' ? { ...loc, ...newOrigin } : loc));
          }}
          onSelectDestination={handleAdventureSelect}
          onClose={() => setShowAdventureMode(false)}
        />
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

import { useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react';
import { Map } from './components/Map/Map';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { AdventureMode } from './components/Trip/AdventureMode';
import { LandingScreen } from './components/Landing/LandingScreen';
import { MobileBottomSheet } from './components/Trip/MobileBottomSheet';
import { MobileStepSheet } from './components/Trip/MobileStepSheet';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PlanningStepContent } from './components/Steps/PlanningStepContent';
import './styles/sidebar.css';
import { TripProvider, useTripContext, DEFAULT_LOCATIONS } from './contexts';
import {
  useWizard, useTripCalculation, useJournal, usePOI, useEagerRoute, useAddedStops,
  useStylePreset, useTripMode, useTripLoader, useMapInteractions, useURLHydration,
  type PlanningStep,
} from './hooks';
import { recordTrip } from './lib/user-profile';
import { getHistory } from './lib/storage';
import type { TripSummary, TripMode, POICategory } from './types';

// ==================== APP CONTENT (uses hooks) ====================

function AppContent() {
  // Context
  const { locations, setLocations, vehicle, setVehicle, settings, setSettings, summary, setSummary } = useTripContext();

  // Eager route preview (dashed line before full calculation)
  const previewGeometry = useEagerRoute(locations);

  // Stable refs — break circular dep between hooks, avoid stale closure in recordTrip
  const onCalcCompleteRef = useRef<() => void>(() => {});
  const settingsRef = useRef(settings);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Local state
  const [tripConfirmed, setTripConfirmed] = useState(false);
  const [history] = useState<TripSummary[]>(() => getHistory());

  // Mode management
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

  // Trip calculation
  const {
    isCalculating, error: calcError, shareUrl,
    strategicFuelStops, showOvernightPrompt, suggestedOvernightStop,
    dismissOvernightPrompt, calculateTrip,
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

  // Keep both refs current every render (no dep array = runs after every render)
  useLayoutEffect(() => {
    settingsRef.current = settings;
    onCalcCompleteRef.current = () => {
      markStepComplete(1); markStepComplete(2); markStepComplete(3); forceStep(3);
    };
  });

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

  // Scroll sidebar to top on step change
  useEffect(() => {
    sidebarScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [planningStep]);

  // ==================== DERIVED / LOCAL CALLBACKS ====================

  const error = poiError || calcError;

  const clearError = useCallback(() => { clearPOIError(); clearCalcError(); }, [clearPOIError, clearCalcError]);
  // Bind shareUrl into copyShareLink so PlanningStepContent gets () => void
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
  }, [resetTrip, resetWizard, setTripMode, setShowAdventureMode]);

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
      onAddPOI={addPOI} onDismissPOI={dismissPOI}
      onOpenGoogleMaps={openInGoogleMaps}
      onCopyShareLink={copyShareLink}
      onStartJournal={startJournal}
      onUpdateJournal={updateActiveJournal}
      onGoToStep={goToStep}
      onConfirmTrip={() => setTripConfirmed(true)}
      onUnconfirmTrip={() => { setTripConfirmed(false); setViewMode('plan'); }}
    />
  );

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <Sidebar
        planningStep={planningStep} completedSteps={completedSteps}
        canProceedFromStep1={canProceedFromStep1} canProceedFromStep2={canProceedFromStep2}
        isCalculating={isCalculating}
        onStepClick={handleStepClick} onNext={goToNextStep} onBack={goToPrevStep} onReset={resetTrip}
        tripMode={tripMode}
        showModeSwitcher={showModeSwitcher} setShowModeSwitcher={setShowModeSwitcher}
        modeSwitcherRef={modeSwitcherRef} onSwitchMode={handleSwitchMode}
        markerCategories={markerCategories} loadingCategory={loadingCategory}
        onToggleCategory={handleToggleCategory}
        error={error} onClearError={clearError}
        sidebarScrollRef={sidebarScrollRef}
      >
        {stepContent}
      </Sidebar>

      {/* Map area */}
      <div className="flex-1 relative h-full md:h-full order-1 md:order-2">
        <Map
          locations={locations} routeGeometry={validRouteGeometry}
          feasibilityStatus={routeFeasibilityStatus} pois={pois}
          markerCategories={markerCategories} tripActive={tripActive}
          strategicFuelStops={strategicFuelStops} addedPOIIds={addedPOIIds}
          dayOptions={mapDayOptions} onMapClick={handleMapClick}
          onAddPOI={summary ? handleAddPOIFromMap : undefined}
          previewGeometry={validRouteGeometry ? null : previewGeometry}
          tripMode={tripMode}
        />
        {summary && planningStep === 3 && (
          <div className="hidden md:block">
            <TripSummaryCard
              summary={summary} settings={settings} tripActive={tripActive}
              onStop={() => setTripActive(false)} onOpenVehicleTab={() => goToStep(2)}
            />
          </div>
        )}
      </div>

      {/* Mobile: steps 1 & 2 sheet */}
      {planningStep < 3 && (
        <div className="md:hidden">
          <MobileStepSheet
            stepNumber={planningStep as 1 | 2}
            stepTitle={planningStep === 1 ? 'Where are you going?' : 'Trip settings'}
            tripMode={tripMode}
            canProceed={planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2}
            isLoading={isCalculating}
            onNext={goToNextStep}
            nextLabel={
              isCalculating ? 'Calculating…' :
              planningStep === 2 ? (tripMode === 'estimate' ? 'Price My MEE Time' : tripMode === 'adventure' ? 'Find My MEE Time' : 'Design My MEE Time') :
              'Next'
            }
            onBack={planningStep > 1 ? goToPrevStep : undefined}
            hasPreview={!!previewGeometry}
          >
            {stepContent}
          </MobileStepSheet>
        </div>
      )}

      {/* Mobile: step 3 bottom sheet */}
      {planningStep === 3 && (
        <div className="md:hidden">
          <MobileBottomSheet
            summary={summary} settings={settings}
            onReset={resetTrip} onGoBack={goToPrevStep} viewMode={viewMode}
            poiBar={
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {markerCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => !loadingCategory && handleToggleCategory(cat.id)}
                    disabled={!!loadingCategory}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${cat.visible ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:bg-muted'} ${loadingCategory && loadingCategory !== cat.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span>{cat.emoji}</span><span>{cat.label}</span>
                  </button>
                ))}
              </div>
            }
          >
            {stepContent}
          </MobileBottomSheet>
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

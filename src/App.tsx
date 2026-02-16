import { useEffect, useMemo, useState, useCallback } from 'react';
import { Map } from './components/Map/Map';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { Button } from './components/UI/Button';
import { Card, CardContent } from './components/UI/Card';
import { StepIndicator } from './components/UI/StepIndicator';
import type { Location, TripSummary } from './types';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getHistory } from './lib/storage';
import { parseStateFromURL } from './lib/url';
import { Spinner } from './components/UI/Spinner';
import { AdventureMode, type AdventureSelection } from './components/Trip/AdventureMode';
import { Step1Content, Step2Content, Step3Content } from './components/Steps';

// Import contexts and hooks
import { TripProvider, useTripContext, DEFAULT_LOCATIONS } from './contexts';
import { useWizard, useTripCalculation, useJournal, usePOI, type PlanningStep } from './hooks';

// ==================== APP CONTENT (uses hooks) ====================

function AppContent() {
  const {
    locations,
    setLocations,
    vehicle,
    setVehicle,
    settings,
    setSettings,
    summary,
    setSummary,
  } = useTripContext();

  // POI Hook
  const {
    pois,
    markerCategories,
    loadingCategory,
    poiSuggestions,
    isLoadingPOIs,
    error: poiError,
    toggleCategory,
    addPOI,
    dismissPOI,
    fetchRoutePOIs,
    clearError: clearPOIError,
  } = usePOI();

  // Trip Calculation Hook
  const {
    isCalculating,
    error: calcError,
    shareUrl,
    strategicFuelStops,
    showOvernightPrompt,
    suggestedOvernightStop,
    dismissOvernightPrompt,
    calculateTrip,
    updateStopType,
    clearError: clearCalcError,
  } = useTripCalculation({
    locations,
    vehicle,
    settings,
    onSummaryChange: setSummary,
    onCalculationComplete: () => {
      markStepComplete(1);
      markStepComplete(2);
    },
  });

  // Wizard Hook
  const {
    planningStep,
    completedSteps,
    canProceedFromStep1,
    canProceedFromStep2,
    goToNextStep: wizardNext,
    goToPrevStep,
    goToStep,
    markStepComplete,
    resetWizard,
  } = useWizard({
    locations,
    vehicle,
    onCalculate: async () => {
      await calculateTrip();
      // Fetch POIs after calculation
      const origin = locations.find(l => l.type === 'origin');
      const destination = locations.find(l => l.type === 'destination');
      if (origin && destination && summary?.fullGeometry) {
        await fetchRoutePOIs(
          summary.fullGeometry as [number, number][],
          origin,
          destination,
          settings.tripPreferences,
          summary.segments
        );
      }
    },
  });

  // Journal Hook
  const {
    activeJournal,
    viewMode,
    startJournal,
    updateActiveJournal,
    setViewMode,
  } = useJournal({
    summary,
    settings,
    vehicle,
  });

  // Local UI State
  const [mobileView, setMobileView] = useState<'map' | 'plan'>('map');
  const [tripActive, setTripActive] = useState(false);
  const [history] = useState<TripSummary[]>(() => getHistory());
  const [showAdventureMode, setShowAdventureMode] = useState(false);

  // Combined error state
  const error = poiError || calcError;
  const clearError = () => {
    clearPOIError();
    clearCalcError();
  };

  // Load state from URL on mount
  useEffect(() => {
    const parsedState = parseStateFromURL();
    if (parsedState) {
      if (parsedState.locations) setLocations(parsedState.locations);
      if (parsedState.vehicle) setVehicle(parsedState.vehicle);
      if (parsedState.settings) setSettings(parsedState.settings);
      if (parsedState.locations?.some(l => l.name)) {
        markStepComplete(1);
        markStepComplete(2);
        goToStep(3);
      }
    }
  }, [setLocations, setVehicle, setSettings, markStepComplete, goToStep]);

  // Recalculate departure time when using "Arrive By"
  useEffect(() => {
    if (settings.useArrivalTime && settings.arrivalDate && settings.arrivalTime && summary) {
      const arrivalDateTime = new Date(`${settings.arrivalDate}T${settings.arrivalTime}`);
      const departureDateTime = new Date(arrivalDateTime.getTime() - (summary.totalDurationMinutes * 60 * 1000));
      const newDepDate = departureDateTime.toISOString().split('T')[0];
      const newDepTime = departureDateTime.toTimeString().slice(0, 5);
      if (newDepDate !== settings.departureDate || newDepTime !== settings.departureTime) {
        setSettings(prev => ({ ...prev, departureDate: newDepDate, departureTime: newDepTime }));
      }
    }
  }, [settings.useArrivalTime, settings.arrivalDate, settings.arrivalTime, summary, settings.departureDate, settings.departureTime, setSettings]);

  // Valid route geometry for map
  const validRouteGeometry = useMemo(() => {
    const geometry = summary?.fullGeometry;
    if (!geometry) return null;
    const filtered = geometry.filter(coord =>
      coord && Array.isArray(coord) && coord.length === 2 &&
      typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
      !isNaN(coord[0]) && !isNaN(coord[1]) && coord[0] !== 0 && coord[1] !== 0
    );
    return filtered.length >= 2 ? filtered as [number, number][] : null;
  }, [summary]);

  // Handlers
  const goToNextStep = useCallback(() => {
    if (planningStep === 2) {
      calculateTrip();
    } else {
      wizardNext();
    }
  }, [planningStep, calculateTrip, wizardNext]);

  const handleStepClick = useCallback((step: PlanningStep) => {
    goToStep(step);
  }, [goToStep]);

  const handleToggleCategory = useCallback((id: import('./types').POICategory) => {
    const searchLocation = locations.find(l => l.type === 'destination' && l.lat !== 0) || locations[0];
    toggleCategory(id, searchLocation.lat !== 0 ? searchLocation : null);
  }, [locations, toggleCategory]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      const name = data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      const originEmpty = !locations[0]?.name || locations[0].lat === 0;
      const destEmpty = !locations[locations.length - 1]?.name || locations[locations.length - 1].lat === 0;

      if (originEmpty) {
        setLocations(prev => prev.map((loc, i) => i === 0 ? { ...loc, name, lat, lng } : loc));
      } else if (destEmpty) {
        setLocations(prev => prev.map((loc, i) => i === prev.length - 1 ? { ...loc, name, lat, lng } : loc));
      } else {
        const newWaypoint: Location = { id: `waypoint-${Date.now()}`, name, lat, lng, type: 'waypoint' };
        setLocations(prev => [...prev.slice(0, -1), newWaypoint, prev[prev.length - 1]]);
      }
    } catch (err) {
      console.error('Failed to reverse geocode:', err);
    }
  }, [locations, setLocations]);

  const copyShareLink = useCallback(() => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied!');
    }
  }, [shareUrl]);

  const openInGoogleMaps = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0);
    if (validLocations.length < 2) return;
    const origin = validLocations[0];
    const destination = validLocations[validLocations.length - 1];
    const waypoints = validLocations.slice(1, -1).map(loc => `${loc.lat},${loc.lng}`).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, '_blank');
  }, [locations]);

  const handleAdventureSelect = useCallback((selection: AdventureSelection) => {
    setLocations(prev => prev.map(loc =>
      loc.type === 'destination' ? { ...loc, ...selection.destination, type: 'destination' as const } : loc
    ));

    type BudgetProfile = 'balanced' | 'foodie' | 'scenic' | 'backpacker' | 'comfort' | 'custom';
    const preferenceToProfile: Record<string, BudgetProfile> = {
      foodie: 'foodie', scenic: 'scenic', budget: 'backpacker', family: 'comfort',
    };

    let budgetProfile: BudgetProfile = 'balanced';
    if (selection.preferences.length > 0) {
      budgetProfile = preferenceToProfile[selection.preferences[0]] || 'balanced';
    } else if (selection.accommodationType === 'budget') {
      budgetProfile = 'backpacker';
    } else if (selection.accommodationType === 'comfort') {
      budgetProfile = 'comfort';
    }

    const estimatedGasCost = Math.round(selection.estimatedDistanceKm * 0.12);
    const remainingBudget = selection.budget - estimatedGasCost;
    const discretionaryWeights: Record<BudgetProfile, { hotel: number; food: number; misc: number }> = {
      balanced: { hotel: 45, food: 40, misc: 15 },
      foodie: { hotel: 25, food: 60, misc: 15 },
      scenic: { hotel: 50, food: 30, misc: 20 },
      backpacker: { hotel: 35, food: 40, misc: 25 },
      comfort: { hotel: 55, food: 35, misc: 10 },
      custom: { hotel: 45, food: 40, misc: 15 },
    };
    const discWeights = discretionaryWeights[budgetProfile];
    const hotelAmount = Math.round(remainingBudget * (discWeights.hotel / 100));
    const foodAmount = Math.round(remainingBudget * (discWeights.food / 100));
    const miscAmount = Math.round(remainingBudget * (discWeights.misc / 100));
    const totalBudget = selection.budget;
    const actualWeights = {
      gas: Math.round((estimatedGasCost / totalBudget) * 100),
      hotel: Math.round((hotelAmount / totalBudget) * 100),
      food: Math.round((foodAmount / totalBudget) * 100),
      misc: Math.round((miscAmount / totalBudget) * 100),
    };

    setSettings(prev => ({
      ...prev,
      numTravelers: selection.travelers,
      numDrivers: Math.min(selection.travelers, prev.numDrivers),
      isRoundTrip: selection.isRoundTrip,
      tripPreferences: selection.preferences,
      departureDate: selection.departureDate,
      departureTime: selection.departureTime,
      budget: {
        ...prev.budget,
        profile: budgetProfile,
        weights: actualWeights,
        allocation: 'fixed' as const,
        total: totalBudget,
        gas: estimatedGasCost,
        hotel: hotelAmount,
        food: foodAmount,
        misc: miscAmount,
      },
    }));

    setShowAdventureMode(false);
    markStepComplete(1);
    goToStep(2);
  }, [setLocations, setSettings, markStepComplete, goToStep]);

  const resetTrip = useCallback(() => {
    setLocations(DEFAULT_LOCATIONS);
    setSummary(null);
    resetWizard();
  }, [setLocations, setSummary, resetWizard]);

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div className={`w-full md:w-[420px] ${
        planningStep === 3 && mobileView === 'plan' ? 'h-full' : 'h-[45vh]'
      } md:h-full flex flex-col border-b md:border-b-0 md:border-r bg-card z-10 shadow-xl order-2 md:order-1 ${
        planningStep === 3 && mobileView === 'map' ? 'hidden md:flex' : ''
      }`}>
        {/* Header */}
        <div className="p-4 border-b bg-card">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            Roadtrip Planner
          </h1>
          <StepIndicator
            currentStep={planningStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />
        </div>

        {/* Mobile View Toggle */}
        {planningStep === 3 && (
          <div className="md:hidden px-4 py-2 border-b bg-muted/10">
            <div className="flex gap-2">
              <button
                onClick={() => setMobileView('plan')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mobileView === 'plan' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                📋 Plan
              </button>
              <button
                onClick={() => setMobileView('map')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mobileView === 'map' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                🗺️ Map
              </button>
            </div>
          </div>
        )}

        {/* POI Controls */}
        {planningStep === 3 && (
          <div className="px-4 py-2 border-b bg-muted/20 flex gap-2 overflow-x-auto no-scrollbar items-center">
            {markerCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => !loadingCategory && handleToggleCategory(cat.id)}
                disabled={!!loadingCategory}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                  cat.visible ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                } ${loadingCategory && loadingCategory !== cat.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loadingCategory === cat.id ? <Spinner size={12} className="text-current" /> : <span>{cat.emoji}</span>}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
            <button onClick={clearError} className="ml-auto font-bold">×</button>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Card className="border-0 shadow-none">
            <CardContent className="px-0 pt-0">
              {/* STEP 1 */}
              {planningStep === 1 && (
                <Step1Content
                  locations={locations}
                  setLocations={setLocations}
                  settings={settings}
                  setSettings={setSettings}
                  onShowAdventure={() => setShowAdventureMode(true)}
                />
              )}

              {/* STEP 2 */}
              {planningStep === 2 && (
                <Step2Content
                  vehicle={vehicle}
                  setVehicle={setVehicle}
                  settings={settings}
                  setSettings={setSettings}
                />
              )}

              {/* STEP 3 */}
              {planningStep === 3 && (
                <Step3Content
                  summary={summary}
                  settings={settings}
                  vehicle={vehicle}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  activeJournal={activeJournal}
                  showOvernightPrompt={showOvernightPrompt}
                  suggestedOvernightStop={suggestedOvernightStop}
                  poiSuggestions={poiSuggestions}
                  isLoadingPOIs={isLoadingPOIs}
                  history={history}
                  shareUrl={shareUrl}
                  onOpenGoogleMaps={openInGoogleMaps}
                  onCopyShareLink={copyShareLink}
                  onStartJournal={startJournal}
                  onUpdateJournal={updateActiveJournal}
                  onUpdateStopType={updateStopType}
                  onDismissOvernight={dismissOvernightPrompt}
                  onAddPOI={addPOI}
                  onDismissPOI={dismissPOI}
                  onGoToStep={goToStep}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Footer */}
        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            {planningStep > 1 && (
              <Button variant="outline" onClick={goToPrevStep} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {planningStep < 3 && (
              <Button
                onClick={goToNextStep}
                disabled={(planningStep === 1 && !canProceedFromStep1) || (planningStep === 2 && !canProceedFromStep2) || isCalculating}
                className="flex-1"
              >
                {isCalculating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Calculating...</>
                ) : planningStep === 2 ? (
                  <>Plan My Trip <ChevronRight className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            )}
            {planningStep === 3 && (
              <Button onClick={resetTrip} variant="outline" className="flex-1">
                Plan New Trip
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className={`flex-1 relative ${
        planningStep === 3 && mobileView === 'map' ? 'h-full' : 'h-[55vh]'
      } md:h-full order-1 md:order-2 ${
        planningStep === 3 && mobileView === 'plan' ? 'hidden md:block' : ''
      }`}>
        <Map
          locations={locations}
          routeGeometry={validRouteGeometry}
          pois={pois}
          markerCategories={markerCategories}
          tripActive={tripActive}
          strategicFuelStops={strategicFuelStops}
          onMapClick={handleMapClick}
        />
        {summary && planningStep === 3 && (
          <TripSummaryCard
            summary={summary}
            settings={settings}
            tripActive={tripActive}
            onStop={() => setTripActive(false)}
            onOpenVehicleTab={() => goToStep(2)}
          />
        )}
      </div>

      {/* Adventure Mode Modal */}
      {showAdventureMode && (
        <AdventureMode
          origin={locations.find(l => l.type === 'origin') || null}
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

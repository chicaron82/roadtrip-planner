import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Map } from './components/Map/Map';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { Button } from './components/UI/Button';
import { Card, CardContent } from './components/UI/Card';
import { StepIndicator } from './components/UI/StepIndicator';
import type { Location, TripChallenge, TripSummary, TripMode, TripOrigin } from './types';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getHistory } from './lib/storage';
import { parseStateFromURL, type TemplateImportResult } from './lib/url';
import { Spinner } from './components/UI/Spinner';
import { AdventureMode, type AdventureSelection } from './components/Trip/AdventureMode';
import { buildAdventureBudget } from './lib/adventure-service';
import { Step1Content, Step2Content, Step3Content } from './components/Steps';
import { LandingScreen } from './components/Landing/LandingScreen';
import './styles/sidebar.css';

// Import contexts and hooks
import { TripProvider, useTripContext, DEFAULT_LOCATIONS } from './contexts';
import { useWizard, useTripCalculation, useJournal, usePOI, type PlanningStep } from './hooks';
import { useAddedStops } from './hooks/useAddedStops';
import type { SuggestedStop } from './lib/stop-suggestions';

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

  // Stable ref for post-calculation callback (breaks circular dep between hooks)
  const onCalcCompleteRef = React.useRef<() => void>(() => {});

  // Ref to scroll sidebar to top on step change
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

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
    resetPOIs,
  } = usePOI();

  // Added Stops Hook (map-click → add to plan)
  const {
    addedStops,
    addedPOIIds,
    addStop,
    clearStops,
    asSuggestedStops,
  } = useAddedStops();

  // Trip confirmation gate (Phase 3)
  const [tripConfirmed, setTripConfirmed] = useState(false);

  // Take Me Home (Phase 4) — mirror gas/hotel stops onto the return leg
  const mirroredReturnStops = useMemo((): SuggestedStop[] => {
    if (!summary || !settings.isRoundTrip || addedStops.length === 0) return [];
    const total = summary.segments.length;
    const midpoint = total / 2;
    return addedStops
      .filter(s =>
        s.afterSegmentIndex < midpoint &&
        (s.poi.category === 'gas' || s.poi.category === 'hotel')
      )
      .map(s => ({
        id: `return-${s.id}`,
        type: s.stopType,
        reason: `${s.poi.name} (return leg)`,
        afterSegmentIndex: (total - 1) - s.afterSegmentIndex,
        estimatedTime: new Date(),
        duration: s.duration,
        priority: 'optional' as const,
        details: { fuelCost: s.stopType === 'fuel' ? s.estimatedCost : undefined },
        accepted: true,
      }));
  }, [addedStops, summary, settings.isRoundTrip]);

  const handleAddPOIFromMap = useCallback((poi: import('./types').POI, afterSegmentIndex?: number) => {
    if (!summary) return;
    addStop(poi, summary.segments, afterSegmentIndex);
  }, [addStop, summary]);

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
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
    clearError: clearCalcError,
  } = useTripCalculation({
    locations,
    vehicle,
    settings,
    onSummaryChange: setSummary,
    onCalculationComplete: () => onCalcCompleteRef.current(),
  });

  // Calculate trip + fetch POIs together (used by both wizard and direct button)
  const calculateAndDiscover = useCallback(async () => {
    setTripConfirmed(false); // New route calculation = plan needs reconfirmation
    const tripResult = await calculateTrip();
    if (!tripResult) return;
    // Fetch POIs using returned summary (avoids stale closure)
    const origin = locations.find(l => l.type === 'origin');
    const destination = locations.find(l => l.type === 'destination');
    if (origin && destination && tripResult.fullGeometry) {
      fetchRoutePOIs(
        tripResult.fullGeometry as [number, number][],
        origin,
        destination,
        settings.tripPreferences,
        tripResult.segments
      );
    }
  }, [calculateTrip, locations, settings.tripPreferences, fetchRoutePOIs]);

  // Wizard Hook
  const {
    planningStep,
    completedSteps,
    canProceedFromStep1,
    canProceedFromStep2,
    goToNextStep: wizardNext,
    goToPrevStep,
    goToStep,
    forceStep,
    markStepComplete,
    resetWizard,
  } = useWizard({
    locations,
    vehicle,
    onCalculate: calculateAndDiscover,
  });

  // Wire up the calculation-complete callback now that markStepComplete is available
  onCalcCompleteRef.current = () => {
    markStepComplete(1);
    markStepComplete(2);
    markStepComplete(3);
    forceStep(3);
  };

  // Active challenge (set when user loads a challenge card)
  const [activeChallenge, setActiveChallenge] = useState<TripChallenge | null>(null);

  // Build origin for journal from active challenge or template import
  const journalOrigin = useState<TripOrigin | null>(null);
  const [tripOrigin, setTripOrigin] = journalOrigin;

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
    origin: tripOrigin,
    defaultTitle: activeChallenge?.title,
  });

  // Local UI State
  const [mobileView, setMobileView] = useState<'map' | 'plan'>('map');
  const [tripActive, setTripActive] = useState(false);
  const [history] = useState<TripSummary[]>(() => getHistory());
  const [showAdventureMode, setShowAdventureMode] = useState(false);
  const [tripMode, setTripMode] = useState<TripMode | null>(null);
  const [showModeSwitcher, setShowModeSwitcher] = useState(false);
  const modeSwitcherRef = useRef<HTMLDivElement>(null);

  // Click-outside to close mode switcher
  useEffect(() => {
    if (!showModeSwitcher) return;
    const handler = (e: MouseEvent) => {
      if (modeSwitcherRef.current && !modeSwitcherRef.current.contains(e.target as Node)) {
        setShowModeSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModeSwitcher]);

  // Combined error state
  const error = poiError || calcError;
  const clearError = () => {
    clearPOIError();
    clearCalcError();
  };

  // Load state from URL on mount (run once)
  useEffect(() => {
    const parsedState = parseStateFromURL();
    if (parsedState) {
      if (parsedState.locations) setLocations(parsedState.locations);
      if (parsedState.vehicle) setVehicle(parsedState.vehicle);
      if (parsedState.settings) setSettings(parsedState.settings);
      if (parsedState.locations?.some(l => l.name)) {
        markStepComplete(1);
        markStepComplete(2);
        markStepComplete(3);
        forceStep(3);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Scroll sidebar to top when step changes & show plan on mobile at step 3
  useEffect(() => {
    sidebarScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    if (planningStep === 3) {
      setMobileView('plan');
    }
  }, [planningStep]);

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

  // Build day options for map popup day picker
  const mapDayOptions = useMemo(() => {
    if (!summary?.days || summary.days.length <= 1) return undefined;
    return summary.days.map(day => ({
      dayNumber: day.dayNumber,
      label: `Day ${day.dayNumber} — ${day.route}`,
      // Use the last segment index of this day for afterSegmentIndex
      segmentIndex: day.segmentIndices[day.segmentIndices.length - 1] ?? 0,
    }));
  }, [summary?.days]);

  // Handlers
  const goToNextStep = useCallback(() => {
    if (planningStep === 2) {
      calculateAndDiscover();
    } else {
      wizardNext();
    }
  }, [planningStep, calculateAndDiscover, wizardNext]);

  const handleStepClick = useCallback((step: PlanningStep) => {
    goToStep(step);
  }, [goToStep]);

  const handleToggleCategory = useCallback((id: import('./types').POICategory) => {
    const searchLocation = locations.find(l => l.type === 'destination' && l.lat !== 0) || locations[0];
    toggleCategory(id, searchLocation.lat !== 0 ? searchLocation : null, validRouteGeometry);
  }, [locations, toggleCategory, validRouteGeometry]);

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

  // Import a shared trip template — populates locations, vehicle, settings
  const handleImportTemplate = useCallback((result: TemplateImportResult) => {
    // Load locations
    if (result.locations.length > 0) {
      setLocations(result.locations);
    }

    // Load vehicle if present
    if (result.vehicle) {
      setVehicle(result.vehicle);
    }

    // Merge shared settings into current settings (partial merge, keep user's dates/times)
    if (result.settings) {
      setSettings(prev => ({ ...prev, ...result.settings }));
    }

    // Record origin as template fork
    setActiveChallenge(null);
    setTripOrigin({
      type: 'template',
      title: result.meta.title,
      author: result.meta.author,
    });

    // Mark steps 1+2 complete and jump to step 2 (so they can review vehicle)
    markStepComplete(1);
    if (result.vehicle) {
      markStepComplete(2);
      forceStep(2);
    }
  }, [setLocations, setVehicle, setSettings, setTripOrigin, markStepComplete, forceStep]);

  // Load a Chicharon's Challenge — converts challenge data into locations/settings/vehicle
  const handleSelectChallenge = useCallback((challenge: TripChallenge) => {
    if (challenge.locations.length > 0) {
      setLocations(challenge.locations);
    }
    if (challenge.vehicle) {
      setVehicle(challenge.vehicle);
    }
    if (challenge.settings) {
      setSettings(prev => ({ ...prev, ...challenge.settings }));
    }
    setActiveChallenge(challenge);
    setTripOrigin({ type: 'challenge', id: challenge.id, title: challenge.title });
    markStepComplete(1);
    if (challenge.vehicle) {
      markStepComplete(2);
      forceStep(2);
    }
  }, [setLocations, setVehicle, setSettings, setTripOrigin, markStepComplete, forceStep]);

  const openInGoogleMaps = useCallback(() => {
    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0);
    if (validLocations.length < 2) return;
    // Use city name/address strings so Google Maps routes to city centres,
    // not whatever business happens to sit at the exact coordinate.
    const locStr = (loc: import('./types').Location) =>
      encodeURIComponent(loc.address || loc.name);
    const origin = validLocations[0];
    const destination = validLocations[validLocations.length - 1];
    const waypoints = validLocations.slice(1, -1).map(locStr).join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${locStr(origin)}&destination=${locStr(destination)}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, '_blank');
  }, [locations]);

  const handleAdventureSelect = useCallback((selection: AdventureSelection) => {
    setLocations(prev => prev.map(loc =>
      loc.type === 'destination' ? { ...loc, ...selection.destination, type: 'destination' as const } : loc
    ));

    const adventureBudget = buildAdventureBudget(
      selection.budget,
      selection.estimatedDistanceKm,
      selection.preferences,
      selection.accommodationType,
    );

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
        profile: adventureBudget.profile,
        weights: adventureBudget.weights,
        allocation: 'fixed' as const,
        total: adventureBudget.total,
        gas: adventureBudget.gas,
        hotel: adventureBudget.hotel,
        food: adventureBudget.food,
        misc: adventureBudget.misc,
      },
    }));

    setShowAdventureMode(false);
    markStepComplete(1);
    goToStep(2);
  }, [setLocations, setSettings, markStepComplete, goToStep]);

  const resetTrip = useCallback(() => {
    setLocations(DEFAULT_LOCATIONS);
    setSummary(null);
    resetPOIs();
    resetWizard();
    clearStops();
    setActiveChallenge(null);
    setTripOrigin(null);
    setTripConfirmed(false);
    // Stay in current mode — go to Step 1, not landing
  }, [setLocations, setSummary, resetWizard, resetPOIs, clearStops, setTripOrigin]);

  // Handle mode selection from landing screen
  const handleSelectMode = useCallback((mode: TripMode) => {
    // Reset wizard to Step 1 so stale URL state doesn't jump to results
    resetWizard();
    setTripMode(mode);
    if (mode === 'adventure') {
      setShowAdventureMode(true);
    }
  }, [resetWizard]);

  // Handle continue saved trip from landing
  const handleContinueSavedTrip = useCallback(() => {
    setTripMode('plan');
  }, []);

  // ==================== RENDER ====================

  // Show landing screen when no mode is selected
  if (!tripMode) {
    return (
      <LandingScreen
        onSelectMode={handleSelectMode}
        hasSavedTrip={history.length > 0}
        onContinueSavedTrip={handleContinueSavedTrip}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar — dark mission control */}
      <div className={`sidebar-dark sidebar-entrance w-full md:w-[420px] ${
        planningStep === 3 && mobileView === 'plan' ? 'h-full' : 'h-[45vh]'
      } md:h-full flex flex-col z-10 shadow-2xl order-2 md:order-1 ${
        planningStep === 3 && mobileView === 'map' ? 'hidden md:flex' : ''
      }`} style={{ background: 'hsl(225 30% 8%)' }}>
        {/* Header */}
        <div className="sidebar-header p-4">
          <div className="mb-3">
            <div className="flex items-center gap-2.5">
              <h1 className="sidebar-brand-title">
                The Experience Engine
              </h1>
              {/* Mode badge — click to switch modes */}
              <div className="relative" ref={modeSwitcherRef}>
                <button
                  onClick={() => setShowModeSwitcher(prev => !prev)}
                  className="mode-badge text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full whitespace-nowrap cursor-pointer transition-all hover:brightness-125"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    background: tripMode === 'estimate' ? 'rgba(59, 130, 246, 0.15)' : tripMode === 'adventure' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: tripMode === 'estimate' ? '#93C5FD' : tripMode === 'adventure' ? '#FDE68A' : '#BBF7D0',
                    border: `1px solid ${tripMode === 'estimate' ? 'rgba(59, 130, 246, 0.3)' : tripMode === 'adventure' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                  }}
                  aria-label="Switch trip mode"
                >
                  {tripMode === 'estimate' ? '💰 Estimate' : tripMode === 'adventure' ? '🧭 Adventure' : '📋 Plan'}
                  <span className="ml-1 opacity-50">▾</span>
                </button>

                {/* Mode switcher dropdown */}
                {showModeSwitcher && (
                  <div className="mode-switcher-dropdown">
                    {[
                      { mode: 'plan' as TripMode, icon: '📋', label: 'Plan', desc: 'Full route control', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)' },
                      { mode: 'estimate' as TripMode, icon: '💰', label: 'Estimate', desc: 'What will it cost?', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
                      { mode: 'adventure' as TripMode, icon: '🧭', label: 'Adventure', desc: 'Surprise me', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
                    ].map(({ mode, icon, label, desc, color, bg }) => (
                      <button
                        key={mode}
                        disabled={mode === tripMode}
                        onClick={() => {
                          setShowModeSwitcher(false);
                          if (mode === 'adventure') {
                            setTripMode('adventure');
                            setShowAdventureMode(true);
                          } else {
                            setTripMode(mode);
                          }
                        }}
                        className="mode-switcher-option"
                        style={{
                          '--mode-color': color,
                          '--mode-bg': bg,
                          opacity: mode === tripMode ? 0.5 : 1,
                        } as React.CSSProperties}
                      >
                        <span className="text-base">{icon}</span>
                        <div className="flex-1 text-left">
                          <div className="text-xs font-bold" style={{ color }}>{label}</div>
                          <div className="text-[10px] text-muted-foreground">{desc}</div>
                        </div>
                        {mode === tripMode && (
                          <span className="text-[9px] tracking-wider uppercase" style={{ color }}>Current</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="sidebar-brand-sub">
              Road trips worth remembering
            </p>
          </div>
          <StepIndicator
            currentStep={planningStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />
        </div>

        {/* Mobile View Toggle */}
        {planningStep === 3 && (
          <div className="md:hidden px-4 py-2" style={{ borderBottom: '1px solid hsl(225 18% 16%)' }}>
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
          <div className="poi-bar px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar items-center">
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
        <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4">
          <Card className="border-0 shadow-none">
            <CardContent className="px-0 pt-0">
              {/* STEP 1 */}
              {planningStep === 1 && (
                <Step1Content
                  locations={locations}
                  setLocations={setLocations}
                  settings={settings}
                  setSettings={setSettings}
                  tripMode={tripMode}
                  onShowAdventure={() => setShowAdventureMode(true)}
                  onImportTemplate={handleImportTemplate}
                  onSelectChallenge={handleSelectChallenge}
                />
              )}

              {/* STEP 2 */}
              {planningStep === 2 && (
                <Step2Content
                  vehicle={vehicle}
                  setVehicle={setVehicle}
                  settings={settings}
                  setSettings={setSettings}
                  tripMode={tripMode}
                />
              )}

              {/* STEP 3 */}
              {planningStep === 3 && (
                <Step3Content
                  summary={summary}
                  settings={settings}
                  vehicle={vehicle}
                  tripMode={tripMode}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  activeJournal={activeJournal}
                  activeChallenge={activeChallenge}
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
                  onUpdateDayNotes={updateDayNotes}
                  onUpdateDayTitle={updateDayTitle}
                  onUpdateDayType={updateDayType}
                  onUpdateOvernight={updateDayOvernight}
                  onDismissOvernight={dismissOvernightPrompt}
                  onAddPOI={addPOI}
                  onDismissPOI={dismissPOI}
                  onGoToStep={goToStep}
                  externalStops={[...asSuggestedStops, ...mirroredReturnStops]}
                  tripConfirmed={tripConfirmed}
                  addedStopCount={addedStops.length}
                  onConfirmTrip={() => setTripConfirmed(true)}
                  onUnconfirmTrip={() => { setTripConfirmed(false); setViewMode('plan'); }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Footer */}
        <div className="sidebar-nav-footer p-4">
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
                  <>{tripMode === 'estimate' ? 'Estimate My Trip' : 'Plan My Trip'} <ChevronRight className="h-4 w-4 ml-1" /></>
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
          addedPOIIds={addedPOIIds}
          dayOptions={mapDayOptions}
          onMapClick={handleMapClick}
          onAddPOI={summary ? handleAddPOIFromMap : undefined}
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
          onOriginChange={(newOrigin) => {
            setLocations(prev => prev.map(loc =>
              loc.type === 'origin' ? { ...loc, ...newOrigin } : loc
            ));
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

import { useState, useEffect, useMemo } from 'react';
import { Map } from './components/Map/Map';
import { LocationList } from './components/Trip/LocationList';
import { VehicleForm } from './components/Vehicle/VehicleForm';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { Button } from './components/UI/Button';
import { Card, CardContent } from './components/UI/Card';
import { StepIndicator } from './components/UI/StepIndicator';
import { Input } from './components/UI/Input';
import { Label } from './components/UI/Label';
import type { Location, Vehicle, TripSettings, TripSummary, POI, MarkerCategory, POICategory } from './types';
import { calculateRoute } from './lib/api';
import { calculateTripCosts } from './lib/calculations';
import { ChevronLeft, ChevronRight, Share2, Calendar, Clock, Users, UserCheck, Loader2 } from 'lucide-react';
import { fetchWeather } from './lib/weather';
import { searchNearbyPOIs } from './lib/poi';
import { addToHistory, getHistory, getDefaultVehicleId, getGarage } from './lib/storage';
import { parseStateFromURL, serializeStateToURL } from './lib/url';
import { Spinner } from './components/UI/Spinner';
import { ItineraryTimeline } from './components/Trip/ItineraryTimeline';

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'origin', name: '', lat: 0, lng: 0, type: 'origin' },
  { id: 'dest', name: '', lat: 0, lng: 0, type: 'destination' },
];

const DEFAULT_VEHICLE: Vehicle = {
  year: '2024',
  make: 'Toyota',
  model: 'Camry',
  fuelEconomyCity: 8.7,
  fuelEconomyHwy: 6.2,
  tankSize: 60,
};

const DEFAULT_SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'open',
  budget: 0,
  departureDate: new Date().toISOString().split('T')[0],
  departureTime: '09:00',
  arrivalDate: '',
  arrivalTime: '',
  useArrivalTime: false,
  gasPrice: 1.50,
  isRoundTrip: false,
  avoidTolls: false,
  scenicMode: false,
  routePreference: 'fastest',
};

type PlanningStep = 1 | 2 | 3;

function App() {
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [vehicle, setVehicle] = useState<Vehicle>(DEFAULT_VEHICLE);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<TripSummary | null>(null);

  // Wizard State
  const [planningStep, setPlanningStep] = useState<PlanningStep>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [isCalculating, setIsCalculating] = useState(false);
  const [tripActive, setTripActive] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<TripSummary[]>([]);

  // UI States
  const [loadingCategory, setLoadingCategory] = useState<POICategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  // POI State
  const [pois, setPois] = useState<POI[]>([]);
  const [markerCategories, setMarkerCategories] = useState<MarkerCategory[]>([
    { id: 'gas', label: 'Gas', emoji: '⛽', color: 'bg-green-500', visible: false },
    { id: 'food', label: 'Food', emoji: '🍔', color: 'bg-orange-500', visible: false },
    { id: 'hotel', label: 'Hotel', emoji: '🏨', color: 'bg-blue-500', visible: false },
    { id: 'attraction', label: 'Sights', emoji: '📸', color: 'bg-purple-500', visible: false },
  ]);

  // Validation for steps
  const canProceedFromStep1 = useMemo(() => {
    const hasOrigin = locations.some(l => l.type === 'origin' && l.name);
    const hasDest = locations.some(l => l.type === 'destination' && l.name);
    return hasOrigin && hasDest;
  }, [locations]);

  const canProceedFromStep2 = useMemo(() => {
    return vehicle.fuelEconomyCity > 0 && vehicle.fuelEconomyHwy > 0 && vehicle.tankSize > 0;
  }, [vehicle]);

  // Load state from URL or Storage on mount
  useEffect(() => {
    const parsedState = parseStateFromURL();
    if (parsedState) {
      if (parsedState.locations) setLocations(parsedState.locations);
      if (parsedState.vehicle) setVehicle(parsedState.vehicle);
      if (parsedState.settings) setSettings(parsedState.settings);
      // If we have valid locations from URL, jump to step 3
      if (parsedState.locations?.some(l => l.name)) {
        setCompletedSteps([1, 2]);
        setPlanningStep(3);
      }
    } else {
      const defaultId = getDefaultVehicleId();
      if (defaultId) {
        const garage = getGarage();
        const defV = garage.find(v => v.id === defaultId);
        if (defV) setVehicle(defV);
      }
    }

    setHistory(getHistory());
  }, []);

  const toggleCategory = async (id: POICategory) => {
    setError(null);
    const newCategories = markerCategories.map(c =>
      c.id === id ? { ...c, visible: !c.visible } : c
    );
    setMarkerCategories(newCategories);

    const targetCategory = newCategories.find(c => c.id === id);
    if (targetCategory?.visible) {
      setLoadingCategory(id);
      try {
        const searchLocation = locations.find(l => l.type === 'destination' && l.lat !== 0) || locations[0];
        if (searchLocation.lat !== 0) {
          const newPois = await searchNearbyPOIs(searchLocation.lat, searchLocation.lng, id);
          if (newPois.length === 0) {
            setError(`No ${targetCategory.label} found nearby.`);
          }
          setPois(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNewPois = newPois.filter(p => !existingIds.has(p.id));
            return [...prev, ...uniqueNewPois];
          });
        } else {
          setError("Please select a location first.");
          setMarkerCategories(prev => prev.map(c => c.id === id ? { ...c, visible: false } : c));
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch places.");
        setMarkerCategories(prev => prev.map(c => c.id === id ? { ...c, visible: false } : c));
      } finally {
        setLoadingCategory(null);
      }
    } else {
      setPois(prev => prev.filter(p => p.category !== id));
    }
  };

  // Effect: Recalculate Departure Time when Arrive By is used
  useEffect(() => {
    if (settings.useArrivalTime && settings.arrivalDate && settings.arrivalTime && summary) {
      const arrivalDateTime = new Date(`${settings.arrivalDate}T${settings.arrivalTime}`);
      const departureDateTime = new Date(arrivalDateTime.getTime() - (summary.totalDurationMinutes * 60 * 1000));

      const newDepDate = departureDateTime.toISOString().split('T')[0];
      const newDepTime = departureDateTime.toTimeString().slice(0, 5);

      if (newDepDate !== settings.departureDate || newDepTime !== settings.departureTime) {
        setSettings(prev => ({
          ...prev,
          departureDate: newDepDate,
          departureTime: newDepTime
        }));
      }
    }
  }, [settings.useArrivalTime, settings.arrivalDate, settings.arrivalTime, summary?.totalDurationMinutes, settings.departureDate, settings.departureTime, summary]);

  const handleCalculate = async () => {
    setIsCalculating(true);
    setError(null);
    try {
      const routeData = await calculateRoute(locations, {
        avoidTolls: settings.avoidTolls,
        scenicMode: settings.scenicMode
      });

      if (routeData) {
        const tripSummary = calculateTripCosts(routeData.segments, vehicle, settings);
        tripSummary.fullGeometry = routeData.fullGeometry;

        const segmentsWithWeather = await Promise.all(tripSummary.segments.map(async (seg) => {
          const weather = await fetchWeather(seg.to.lat, seg.to.lng, settings.departureDate);
          return { ...seg, weather: weather || undefined };
        }));

        tripSummary.segments = segmentsWithWeather;
        setSummary(tripSummary);

        setHistory(addToHistory(tripSummary));
        serializeStateToURL(locations, vehicle, settings);
        setShareUrl(window.location.href);

        // Move to results step
        setCompletedSteps(prev => [...new Set([...prev, 1, 2])]);
        setPlanningStep(3);
      } else {
        setError("Could not calculate route. Please check your locations.");
      }
    } catch (e) {
      console.error(e);
      setError("An error occurred while calculating the route.");
    } finally {
      setIsCalculating(false);
    }
  };

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied!");
    }
  };

  const goToNextStep = () => {
    if (planningStep === 1 && canProceedFromStep1) {
      setCompletedSteps(prev => [...new Set([...prev, 1])]);
      setPlanningStep(2);
    } else if (planningStep === 2 && canProceedFromStep2) {
      handleCalculate();
    }
  };

  const goToPrevStep = () => {
    if (planningStep > 1) {
      setPlanningStep((planningStep - 1) as PlanningStep);
    }
  };

  const handleStepClick = (step: PlanningStep) => {
    setPlanningStep(step);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-full md:w-[420px] h-[45vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r bg-card z-10 shadow-xl order-2 md:order-1">
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

        {/* POI Controls - Only show on Step 3 */}
        {planningStep === 3 && (
          <div className="px-4 py-2 border-b bg-muted/20 flex gap-2 overflow-x-auto no-scrollbar items-center">
            {markerCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => !loadingCategory && toggleCategory(cat.id)}
                disabled={!!loadingCategory}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                  cat.visible
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                } ${loadingCategory && loadingCategory !== cat.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loadingCategory === cat.id ? <Spinner size={12} className="text-current" /> : <span>{cat.emoji}</span>}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mx-4 mt-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
            <button onClick={() => setError(null)} className="ml-auto font-bold">×</button>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Card className="border-0 shadow-none">
            <CardContent className="px-0 pt-0">
              {/* STEP 1: Route Planning */}
              {planningStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Where are you going?</h2>
                    <p className="text-sm text-muted-foreground mb-4">Add your starting point, destination, and any stops along the way.</p>
                    <LocationList
                      locations={locations}
                      setLocations={setLocations}
                      onCalculate={() => {}}
                      isCalculating={false}
                      hideCalculateButton
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      When are you leaving?
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="depDate" className="text-xs">Departure Date</Label>
                        <Input
                          id="depDate"
                          type="date"
                          value={settings.departureDate}
                          onChange={(e) => setSettings(prev => ({ ...prev, departureDate: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="depTime" className="text-xs">Departure Time</Label>
                        <Input
                          id="depTime"
                          type="time"
                          value={settings.departureTime}
                          onChange={(e) => setSettings(prev => ({ ...prev, departureTime: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Vehicle & Party */}
              {planningStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">Your Vehicle</h2>
                    <p className="text-sm text-muted-foreground mb-4">Select or configure your vehicle for accurate fuel estimates.</p>
                    <VehicleForm
                      vehicle={vehicle}
                      setVehicle={setVehicle}
                      units={settings.units}
                      setUnits={(value) => setSettings(prev => ({
                        ...prev,
                        units: typeof value === 'function' ? value(prev.units) : value
                      }))}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Who's coming?
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="travelers" className="text-xs flex items-center gap-1">
                          <Users className="h-3 w-3" /> Travelers
                        </Label>
                        <Input
                          id="travelers"
                          type="number"
                          min={1}
                          max={20}
                          value={settings.numTravelers}
                          onChange={(e) => setSettings(prev => ({ ...prev, numTravelers: parseInt(e.target.value) || 1 }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="drivers" className="text-xs flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> Drivers
                        </Label>
                        <Input
                          id="drivers"
                          type="number"
                          min={1}
                          max={settings.numTravelers}
                          value={settings.numDrivers}
                          onChange={(e) => setSettings(prev => ({ ...prev, numDrivers: Math.min(parseInt(e.target.value) || 1, prev.numTravelers) }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {settings.numDrivers > 1
                        ? `${settings.numDrivers} drivers can share the drive.`
                        : 'Consider adding another driver for long trips!'}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Driving Preferences
                    </h3>
                    <div>
                      <Label htmlFor="maxHours" className="text-xs">Max driving hours per day</Label>
                      <Input
                        id="maxHours"
                        type="number"
                        min={1}
                        max={24}
                        value={settings.maxDriveHours}
                        onChange={(e) => setSettings(prev => ({ ...prev, maxDriveHours: parseInt(e.target.value) || 8 }))}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Recommended: 8-10 hours for safe driving.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Results */}
              {planningStep === 3 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">Your Trip</h2>
                      <p className="text-sm text-muted-foreground">Review your route and itinerary.</p>
                    </div>
                    {shareUrl && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={copyShareLink}>
                        <Share2 className="h-3 w-3" /> Share
                      </Button>
                    )}
                  </div>

                  {summary ? (
                    <ItineraryTimeline summary={summary} settings={settings} vehicle={vehicle} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="mb-2">🗺️</div>
                      <p>No route calculated yet.</p>
                      <Button variant="link" onClick={() => setPlanningStep(1)} className="mt-2">
                        Start Planning
                      </Button>
                    </div>
                  )}

                  {/* Recent Trips */}
                  {history.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <h3 className="text-sm font-semibold mb-2">Recent Trips</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {history.slice(0, 3).map((trip, i) => (
                          <div key={i} className="p-2 border rounded text-xs bg-muted/20">
                            <div className="flex justify-between">
                              <span>{trip.totalDistanceKm.toFixed(0)} km</span>
                              <span className="text-green-600">${trip.totalFuelCost.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Footer */}
        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            {planningStep > 1 && (
              <Button
                variant="outline"
                onClick={goToPrevStep}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            {planningStep < 3 && (
              <Button
                onClick={goToNextStep}
                disabled={
                  (planningStep === 1 && !canProceedFromStep1) ||
                  (planningStep === 2 && !canProceedFromStep2) ||
                  isCalculating
                }
                className="flex-1"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Calculating...
                  </>
                ) : planningStep === 2 ? (
                  <>
                    Plan My Trip
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}

            {planningStep === 3 && (
              <Button
                onClick={() => {
                  // Reset for new trip
                  setLocations(DEFAULT_LOCATIONS);
                  setSummary(null);
                  setCompletedSteps([]);
                  setPlanningStep(1);
                  setShareUrl(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Plan New Trip
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative h-[55vh] md:h-full order-1 md:order-2">
        <Map
          locations={locations}
          routeGeometry={summary?.fullGeometry as [number, number][] || null}
          pois={pois}
          markerCategories={markerCategories}
          tripActive={tripActive}
        />

        {summary && planningStep === 3 && (
          <TripSummaryCard
            summary={summary}
            settings={settings}
            tripActive={tripActive}
            onStop={() => setTripActive(false)}
            onOpenVehicleTab={() => setPlanningStep(2)}
          />
        )}
      </div>
    </div>
  );
}

export default App;

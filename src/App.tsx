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
import type { Location, Vehicle, TripSettings, TripSummary, POI, MarkerCategory, POICategory, TripBudget } from './types';
import { calculateRoute } from './lib/api';
import { calculateTripCosts, calculateStrategicFuelStops, calculateArrivalTimes, type StrategicFuelStop } from './lib/calculations';
import { DEFAULT_BUDGET, splitTripByDays, calculateCostBreakdown, getBudgetStatus } from './lib/budget';
import { ChevronLeft, ChevronRight, Share2, Calendar, Clock, Users, UserCheck, Loader2 } from 'lucide-react';
import { OvernightStopPrompt } from './components/Trip/OvernightStopPrompt';
import { fetchWeather } from './lib/weather';
import { searchNearbyPOIs } from './lib/poi';
import { addToHistory, getHistory, getDefaultVehicleId, getGarage } from './lib/storage';
import { parseStateFromURL, serializeStateToURL } from './lib/url';
import { Spinner } from './components/UI/Spinner';
import { ItineraryTimeline } from './components/Trip/ItineraryTimeline';
import { BudgetInput } from './components/Trip/BudgetInput';

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
  budget: DEFAULT_BUDGET,
  departureDate: new Date().toISOString().split('T')[0],
  departureTime: '09:00',
  arrivalDate: '',
  arrivalTime: '',
  useArrivalTime: false,
  gasPrice: 1.50,
  hotelPricePerNight: 150, // Default moderate hotel estimate
  mealPricePerDay: 50, // Default meal budget per person per day
  isRoundTrip: false,
  avoidTolls: false,
  scenicMode: false,
  routePreference: 'fastest',
  stopFrequency: 'balanced',
  tripPreferences: [],
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

  // Strategic Stops State
  const [strategicFuelStops, setStrategicFuelStops] = useState<StrategicFuelStop[]>([]);
  const [showOvernightPrompt, setShowOvernightPrompt] = useState(false);
  const [suggestedOvernightStop, setSuggestedOvernightStop] = useState<Location | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'plan'>('map');


  // Validation for steps
  const canProceedFromStep1 = useMemo(() => {
    const hasOrigin = locations.some(l => l.type === 'origin' && l.name);
    const hasDest = locations.some(l => l.type === 'destination' && l.name);
    return hasOrigin && hasDest;
  }, [locations]);

  const canProceedFromStep2 = useMemo(() => {
    return vehicle.fuelEconomyCity > 0 && vehicle.fuelEconomyHwy > 0 && vehicle.tankSize > 0;
  }, [vehicle]);

  // Safely filter route geometry to ensure valid coordinates
  const validRouteGeometry = useMemo(() => {
    if (!summary?.fullGeometry) return null;

    const filtered = summary.fullGeometry.filter(coord =>
      coord &&
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      coord[0] !== 0 &&
      coord[1] !== 0
    );

    return filtered.length >= 2 ? filtered as [number, number][] : null;
  }, [summary?.fullGeometry]);

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

        // Calculate arrival times for each segment
        const segmentsWithTimes = calculateArrivalTimes(
          segmentsWithWeather,
          settings.departureDate,
          settings.departureTime
        );

        tripSummary.segments = segmentsWithTimes;

        // Split trip into days with budget tracking
        const tripDays = splitTripByDays(
          segmentsWithTimes,
          settings,
          settings.departureDate,
          settings.departureTime
        );
        tripSummary.days = tripDays;

        // Calculate overall cost breakdown
        if (tripDays.length > 0) {
          tripSummary.costBreakdown = calculateCostBreakdown(tripDays, settings.numTravelers);
          tripSummary.budgetStatus = getBudgetStatus(settings.budget, tripSummary.costBreakdown);
          tripSummary.budgetRemaining = settings.budget.total - tripSummary.costBreakdown.total;
        }

        // Apply round trip multiplier if enabled
        if (settings.isRoundTrip) {
          tripSummary.totalDistanceKm *= 2;
          tripSummary.totalDurationMinutes *= 2;
          tripSummary.totalFuelCost *= 2;

          if (tripSummary.costBreakdown) {
            tripSummary.costBreakdown.fuel *= 2;
            tripSummary.costBreakdown.total =
              tripSummary.costBreakdown.fuel +
              tripSummary.costBreakdown.accommodation +
              tripSummary.costBreakdown.meals +
              tripSummary.costBreakdown.misc;
            tripSummary.costBreakdown.perPerson = tripSummary.costBreakdown.total / settings.numTravelers;
            tripSummary.budgetRemaining = settings.budget.total - tripSummary.costBreakdown.total;
            tripSummary.budgetStatus = getBudgetStatus(settings.budget, tripSummary.costBreakdown);
          }
        }

        setSummary(tripSummary);

        // Calculate strategic fuel stops
        const fuelStops = calculateStrategicFuelStops(
          routeData.fullGeometry,
          tripSummary.segments,
          vehicle,
          settings
        );
        setStrategicFuelStops(fuelStops);

        // Check if overnight stop is recommended
        const totalHours = tripSummary.totalDurationMinutes / 60;
        const exceedsMaxHours = totalHours > settings.maxDriveHours;

        if (exceedsMaxHours) {
          // Calculate midpoint for overnight stop
          const targetDistance = tripSummary.totalDistanceKm * 0.5;
          let currentDist = 0;
          let overnightLocation: Location | null = null;

          for (const segment of tripSummary.segments) {
            currentDist += segment.distanceKm;
            if (currentDist >= targetDistance) {
              overnightLocation = segment.to;
              break;
            }
          }

          if (overnightLocation) {
            setSuggestedOvernightStop(overnightLocation);
            setShowOvernightPrompt(true);
          }
        } else {
          setShowOvernightPrompt(false);
        }

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

  const handleUpdateStopType = (segmentIndex: number, newStopType: import('./types').StopType) => {
    if (!summary) return;

    // Update the segment's stop type
    const updatedSegments = summary.segments.map((seg, idx) =>
      idx === segmentIndex ? { ...seg, stopType: newStopType } : seg
    );

    // Recalculate arrival times with new stop durations
    const segmentsWithTimes = calculateArrivalTimes(
      updatedSegments,
      settings.departureDate,
      settings.departureTime
    );

    // Update summary with recalculated times
    setSummary({
      ...summary,
      segments: segmentsWithTimes
    });
  };

  const goToPrevStep = () => {
    if (planningStep > 1) {
      setPlanningStep((planningStep - 1) as PlanningStep);
    }
  };

  const handleStepClick = (step: PlanningStep) => {
    setPlanningStep(step);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    try {
      // Reverse geocode to get location name
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const name = data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      // Find first empty slot or add as waypoint
      const originEmpty = !locations[0]?.name || locations[0].lat === 0;
      const destEmpty = !locations[locations.length - 1]?.name || locations[locations.length - 1].lat === 0;

      if (originEmpty) {
        // Set as origin
        const newLocations = [...locations];
        newLocations[0] = { ...newLocations[0], name, lat, lng };
        setLocations(newLocations);
      } else if (destEmpty) {
        // Set as destination
        const newLocations = [...locations];
        newLocations[newLocations.length - 1] = { ...newLocations[newLocations.length - 1], name, lat, lng };
        setLocations(newLocations);
      } else {
        // Add as waypoint before destination
        const newLocations = [...locations];
        const newWaypoint: Location = {
          id: `waypoint-${Date.now()}`,
          name,
          lat,
          lng,
          type: 'waypoint',
        };
        newLocations.splice(newLocations.length - 1, 0, newWaypoint);
        setLocations(newLocations);
      }
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      setError('Failed to get location name');
    }
  };

  const openInGoogleMaps = () => {
    const validLocations = locations.filter(loc => loc.lat !== 0 && loc.lng !== 0);
    if (validLocations.length < 2) return;

    const origin = validLocations[0];
    const destination = validLocations[validLocations.length - 1];
    const waypoints = validLocations.slice(1, -1).map(loc => `${loc.lat},${loc.lng}`).join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }

    window.open(url, '_blank');
  };

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

        {/* Mobile View Toggle - Only show on mobile at Step 3 */}
        {planningStep === 3 && (
          <div className="md:hidden px-4 py-2 border-b bg-muted/10">
            <div className="flex gap-2">
              <button
                onClick={() => setMobileView('plan')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mobileView === 'plan'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                📋 Plan
              </button>
              <button
                onClick={() => setMobileView('map')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  mobileView === 'map'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                🗺️ Map
              </button>
            </div>
          </div>
        )}

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

                    {/* Round Trip Toggle */}
                    <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">🔄</div>
                        <div>
                          <div className="text-sm font-semibold text-blue-900">Round Trip</div>
                          <div className="text-xs text-blue-600">Return to starting point (doubles costs & distance)</div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.isRoundTrip}
                          onChange={(e) => setSettings(prev => ({ ...prev, isRoundTrip: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        When?
                      </h3>

                      {/* Depart/Arrive Toggle */}
                      <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                        <Button
                          variant={!settings.useArrivalTime ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSettings(prev => ({ ...prev, useArrivalTime: false }))}
                          className="h-7 text-xs gap-1 transition-all"
                        >
                          🚗 Depart
                        </Button>
                        <Button
                          variant={settings.useArrivalTime ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => setSettings(prev => ({ ...prev, useArrivalTime: true }))}
                          className="h-7 text-xs gap-1 transition-all"
                        >
                          🏁 Arrive
                        </Button>
                      </div>
                    </div>

                    {/* Date/Time Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={settings.useArrivalTime ? "arrDate" : "depDate"} className="text-xs">
                          {settings.useArrivalTime ? 'Arrival Date' : 'Departure Date'}
                        </Label>
                        <Input
                          id={settings.useArrivalTime ? "arrDate" : "depDate"}
                          type="date"
                          value={settings.useArrivalTime ? settings.arrivalDate : settings.departureDate}
                          onChange={(e) => setSettings(prev => settings.useArrivalTime
                            ? { ...prev, arrivalDate: e.target.value }
                            : { ...prev, departureDate: e.target.value }
                          )}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={settings.useArrivalTime ? "arrTime" : "depTime"} className="text-xs">
                          {settings.useArrivalTime ? 'Arrival Time' : 'Departure Time'}
                        </Label>
                        <Input
                          id={settings.useArrivalTime ? "arrTime" : "depTime"}
                          type="time"
                          value={settings.useArrivalTime ? settings.arrivalTime : settings.departureTime}
                          onChange={(e) => setSettings(prev => settings.useArrivalTime
                            ? { ...prev, arrivalTime: e.target.value }
                            : { ...prev, departureTime: e.target.value }
                          )}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Smart Preview */}
                    <p className="text-xs text-muted-foreground mt-2 bg-purple-50 border border-purple-100 rounded-md p-2">
                      {settings.useArrivalTime ? (
                        <>
                          🎯 <strong>Arrive by:</strong> {settings.arrivalDate && settings.arrivalTime
                            ? `${new Date(settings.arrivalDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${settings.arrivalTime}`
                            : 'Set your target arrival time'
                          }
                          {settings.arrivalDate && " - We'll calculate when you need to leave!"}
                        </>
                      ) : (
                        <>
                          🚗 <strong>Depart:</strong> {settings.departureDate && settings.departureTime
                            ? `${new Date(settings.departureDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${settings.departureTime}`
                            : 'Set your departure time'
                          }
                          {settings.departureDate && new Date(settings.departureDate) > new Date() &&
                            ` - Leaving in ${Math.ceil((new Date(settings.departureDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days!`
                          }
                        </>
                      )}
                    </p>
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

                  {/* Trip Type Quick Presets */}
                  <div className="border-t pt-4">
                    <Label className="text-xs text-muted-foreground mb-2 block">Quick Setup</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '🎒 Solo', travelers: 1, drivers: 1, hours: 8 },
                        { label: '💑 Couple', travelers: 2, drivers: 1, hours: 8 },
                        { label: '👨‍👩‍👧‍👦 Family', travelers: 4, drivers: 2, hours: 6 },
                        { label: '👥 Group', travelers: 6, drivers: 3, hours: 10 },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          onClick={() => setSettings(prev => ({
                            ...prev,
                            numTravelers: preset.travelers,
                            numDrivers: preset.drivers,
                            maxDriveHours: preset.hours,
                          }))}
                          className="text-xs h-auto py-2 px-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
                        >
                          <div className="text-center">
                            <div className="text-sm mb-0.5">{preset.label.split(' ')[0]}</div>
                            <div className="text-[10px] text-muted-foreground">{preset.label.split(' ')[1]}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Who's coming?
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Travelers Stepper */}
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> Travelers
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 transition-transform active:scale-95"
                            onClick={() => setSettings(prev => ({ ...prev, numTravelers: Math.max(1, prev.numTravelers - 1), numDrivers: Math.min(prev.numDrivers, Math.max(1, prev.numTravelers - 1)) }))}
                          >
                            -
                          </Button>
                          <div className="flex-1 text-center">
                            <div className="font-bold text-2xl">{settings.numTravelers}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 transition-transform active:scale-95"
                            onClick={() => setSettings(prev => ({ ...prev, numTravelers: Math.min(20, prev.numTravelers + 1) }))}
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      {/* Drivers Stepper */}
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> Drivers
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 transition-transform active:scale-95"
                            onClick={() => setSettings(prev => ({ ...prev, numDrivers: Math.max(1, prev.numDrivers - 1) }))}
                          >
                            -
                          </Button>
                          <div className="flex-1 text-center">
                            <div className="font-bold text-2xl">{settings.numDrivers}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 transition-transform active:scale-95"
                            onClick={() => setSettings(prev => ({ ...prev, numDrivers: Math.min(prev.numTravelers, prev.numDrivers + 1) }))}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Visual Ratio Indicator */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex gap-0.5">
                        {Array.from({ length: settings.numTravelers }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i < settings.numDrivers ? 'bg-green-500' : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <span>
                        {settings.numDrivers} of {settings.numTravelers} can drive
                      </span>
                    </div>

                    {/* Smart Tip */}
                    <p className="text-xs text-muted-foreground mt-2 bg-blue-50 border border-blue-100 rounded-md p-2">
                      💡 {settings.numDrivers === 1
                        ? "Solo driver? Recommended max 8 hours per day for safety."
                        : settings.numDrivers === 2
                        ? "With 2 drivers, you can comfortably drive 12 hours by switching every 3 hours!"
                        : `${settings.numDrivers} drivers allows for team rotation - up to 16+ hours possible!`}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Driving Preferences
                    </h3>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">Max driving hours per day</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{settings.maxDriveHours}</span>
                          <span className="text-xs text-muted-foreground">hours</span>
                          {/* Warning Badge */}
                          {settings.maxDriveHours <= 6 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Short</span>}
                          {settings.maxDriveHours > 6 && settings.maxDriveHours <= 10 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Safe</span>}
                          {settings.maxDriveHours > 10 && settings.maxDriveHours <= 14 && settings.numDrivers >= 2 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">! Extended</span>}
                          {settings.maxDriveHours > 10 && settings.numDrivers === 1 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠ Long</span>}
                          {settings.maxDriveHours > 14 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠ Marathon</span>}
                        </div>
                      </div>

                      {/* Color-Coded Slider */}
                      <div className="relative pt-1 pb-2">
                        {/* Background zones */}
                        <div className="absolute inset-0 flex h-2 rounded-full overflow-hidden">
                          <div className="bg-green-200" style={{ width: '30%' }}></div>
                          <div className="bg-yellow-200" style={{ width: '20%' }}></div>
                          <div className="bg-orange-200" style={{ width: '25%' }}></div>
                          <div className="bg-red-200" style={{ width: '25%' }}></div>
                        </div>

                        <input
                          type="range"
                          min={1}
                          max={settings.numDrivers === 1 ? 10 : settings.numDrivers === 2 ? 16 : 20}
                          value={settings.maxDriveHours}
                          onChange={(e) => setSettings(prev => ({ ...prev, maxDriveHours: parseInt(e.target.value) }))}
                          className="relative w-full h-2 bg-transparent appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-5
                            [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-primary
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-webkit-slider-thumb]:border-2
                            [&::-webkit-slider-thumb]:border-white
                            [&::-webkit-slider-thumb]:shadow-lg
                            [&::-webkit-slider-thumb]:transition-transform
                            [&::-webkit-slider-thumb]:hover:scale-110
                            [&::-moz-range-thumb]:w-5
                            [&::-moz-range-thumb]:h-5
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-primary
                            [&::-moz-range-thumb]:cursor-pointer
                            [&::-moz-range-thumb]:border-2
                            [&::-moz-range-thumb]:border-white
                            [&::-moz-range-thumb]:shadow-lg"
                        />

                        {/* Tick marks */}
                        <div className="relative mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>1h</span>
                          <span className="absolute left-[33%] -translate-x-1/2">8h</span>
                          <span className="absolute left-[60%] -translate-x-1/2">12h</span>
                          <span className="absolute left-[80%] -translate-x-1/2">16h</span>
                          <span>{settings.numDrivers === 1 ? '10h' : settings.numDrivers === 2 ? '16h' : '20h'}</span>
                        </div>
                      </div>

                      {/* Dynamic Recommendation */}
                      <p className="text-xs mt-3 p-2 rounded-md bg-blue-50 border border-blue-100 text-blue-700">
                        {settings.numDrivers === 1 && settings.maxDriveHours <= 8 && "✨ Recommended: 8 hours max for safe solo driving."}
                        {settings.numDrivers === 1 && settings.maxDriveHours > 8 && settings.maxDriveHours <= 10 && "⚠️ Solo driver at 9-10 hours. Plan rest stops every 2 hours!"}
                        {settings.numDrivers === 1 && settings.maxDriveHours > 10 && "🛑 Solo driver limit exceeded. Consider adding a second driver or splitting into multi-day trip."}
                        {settings.numDrivers === 2 && settings.maxDriveHours <= 12 && "✨ Perfect! With 2 drivers, swap every 3-4 hours for optimal alertness."}
                        {settings.numDrivers === 2 && settings.maxDriveHours > 12 && settings.maxDriveHours <= 16 && "⚡ Extended driving (12-16h). Ensure both drivers are well-rested!"}
                        {settings.numDrivers >= 3 && settings.maxDriveHours <= 12 && "✨ Team driving! Rotate every 2-3 hours for maximum comfort."}
                        {settings.numDrivers >= 3 && settings.maxDriveHours > 12 && "🚀 Marathon mode! Ensure proper rotation and rest breaks."}
                      </p>
                    </div>
                  </div>

                  {/* Stop Frequency Preference */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      🛑 Stop Frequency
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      How often should we suggest fuel and rest stops?
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {(['conservative', 'balanced', 'aggressive'] as const).map((freq) => (
                        <button
                          key={freq}
                          onClick={() => setSettings(prev => ({ ...prev, stopFrequency: freq }))}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            settings.stopFrequency === freq
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-sm font-medium capitalize mb-1">
                              {freq}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {freq === 'conservative' && 'More frequent\nsafer stops'}
                              {freq === 'balanced' && 'Standard\nintervals'}
                              {freq === 'aggressive' && 'Push further\nfewer stops'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    <p className="text-xs mt-3 p-2 rounded-md bg-purple-50 border border-purple-100 text-purple-700">
                      {settings.stopFrequency === 'conservative' && "🛡️ Conservative: Stop every 1.5 hours, refuel at 30% tank. Best for solo drivers or those with kids."}
                      {settings.stopFrequency === 'balanced' && "⚖️ Balanced: Stop every 2 hours, refuel at 25% tank. Recommended for most trips."}
                      {settings.stopFrequency === 'aggressive' && "⚡ Aggressive: Stop every 2.5 hours, refuel at 20% tank. For experienced drivers who prefer fewer stops."}
                    </p>
                  </div>

                  {/* Trip Preferences */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      🏷️ Trip Style
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose your preferences to get personalized POI suggestions
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'scenic' as const, label: 'Scenic', emoji: '🌿', desc: 'Viewpoints & nature' },
                        { id: 'family' as const, label: 'Family', emoji: '👨‍👩‍👧‍👦', desc: 'Kid-friendly stops' },
                        { id: 'budget' as const, label: 'Budget', emoji: '💸', desc: 'Free/cheap attractions' },
                        { id: 'foodie' as const, label: 'Foodie', emoji: '🍴', desc: 'Local restaurants' },
                      ].map((pref) => (
                        <button
                          key={pref.id}
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              tripPreferences: prev.tripPreferences.includes(pref.id)
                                ? prev.tripPreferences.filter(p => p !== pref.id)
                                : [...prev.tripPreferences, pref.id]
                            }));
                          }}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            settings.tripPreferences.includes(pref.id)
                              ? 'border-primary bg-primary/10'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{pref.emoji}</span>
                            <span className="text-sm font-semibold">{pref.label}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{pref.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trip Budget */}
                  <div className="border-t pt-4">
                    <BudgetInput
                      budget={settings.budget}
                      onChange={(newBudget: TripBudget) => setSettings(prev => ({ ...prev, budget: newBudget }))}
                      currency={settings.currency}
                    />
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
                    <div className="flex gap-2">
                      {summary && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={openInGoogleMaps}>
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          Google Maps
                        </Button>
                      )}
                      {shareUrl && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={copyShareLink}>
                          <Share2 className="h-3 w-3" /> Share
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Overnight Stop Prompt */}
                  {showOvernightPrompt && suggestedOvernightStop && summary && (
                    <OvernightStopPrompt
                      suggestedLocation={suggestedOvernightStop}
                      hoursBeforeStop={(summary.totalDurationMinutes / 60) * 0.5}
                      distanceBeforeStop={summary.totalDistanceKm * 0.5}
                      numTravelers={settings.numTravelers}
                      arrivalTime="5:00 PM"
                      departureTime="8:00 AM"
                      onAccept={() => {
                        // Add overnight stop to locations
                        const updatedLocations = [...locations];
                        updatedLocations.splice(locations.length - 1, 0, {
                          ...suggestedOvernightStop,
                          type: 'waypoint',
                        });
                        setLocations(updatedLocations);
                        setShowOvernightPrompt(false);
                        // Recalculate with new stop
                        setTimeout(() => handleCalculate(), 100);
                      }}
                      onDecline={() => {
                        setShowOvernightPrompt(false);
                      }}
                    />
                  )}

                  {summary ? (
                    <ItineraryTimeline
                      summary={summary}
                      settings={settings}
                      vehicle={vehicle}
                      days={summary.days}
                      onUpdateStopType={handleUpdateStopType}
                    />
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
            onOpenVehicleTab={() => setPlanningStep(2)}
          />
        )}
      </div>
    </div>
  );
}

export default App;

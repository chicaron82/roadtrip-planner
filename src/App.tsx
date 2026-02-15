import { useState, useEffect } from 'react';
import { Map } from './components/Map/Map';
import { LocationList } from './components/Trip/LocationList';
import { VehicleForm } from './components/Vehicle/VehicleForm';
import { SettingsForm } from './components/Settings/SettingsForm';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { Button } from './components/UI/Button';
import { Card, CardContent, CardHeader, CardTitle } from './components/UI/Card';
import type { Location, Vehicle, TripSettings, TripSummary, POI, MarkerCategory, POICategory } from './types';
import { calculateRoute } from './lib/api';
import { calculateTripCosts } from './lib/calculations';
import { MapPin, Settings as SettingsIcon, Car, History, Share2, Calendar } from 'lucide-react';
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

type Tab = 'route' | 'vehicle' | 'settings' | 'history' | 'itinerary';

function App() {
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [vehicle, setVehicle] = useState<Vehicle>(DEFAULT_VEHICLE);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('route');
  
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

  // Load state from URL or Storage on mount
  useEffect(() => {
    // 1. Check URL for shared trip
    const parsedState = parseStateFromURL();
    if (parsedState) {
        if (parsedState.locations) setLocations(parsedState.locations);
        if (parsedState.vehicle) setVehicle(parsedState.vehicle);
        if (parsedState.settings) setSettings(parsedState.settings);
        // Clear URL params to clean up? Or keep them? tailored choice.
        // Let's keep them so refresh works.
    } else {
        // 2. Load default vehicle if exists in garage
        const defaultId = getDefaultVehicleId();
        if (defaultId) {
            const garage = getGarage();
            const defV = garage.find(v => v.id === defaultId);
            if (defV) setVehicle(defV);
        }
    }
    
    // Load history
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
            // Search near destination if exists, else origin
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
                 // Revert toggle
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
        // Parse Arrival DateTime
        const arrivalDateTime = new Date(`${settings.arrivalDate}T${settings.arrivalTime}`);
        
        // Subtract Duration (minutes)
        // We use totalDurationMinutes which includes driving time
        const departureDateTime = new Date(arrivalDateTime.getTime() - (summary.totalDurationMinutes * 60 * 1000));
        
        // Update Settings (avoid infinite loop by checking difference)
        const newDepDate = departureDateTime.toISOString().split('T')[0];
        const newDepTime = departureDateTime.toTimeString().slice(0, 5); // HH:MM
        
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
         
         // Persistence & Sharing
         setHistory(addToHistory(tripSummary));
         serializeStateToURL(locations, vehicle, settings);
         setShareUrl(window.location.href);
         
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
          // Could add a toast here
          alert("Link copied!");
      }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-full md:w-[400px] h-[45vh] md:h-full flex flex-col border-b md:border-b-0 md:border-r bg-card z-10 shadow-xl order-2 md:order-1">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Roadtrip Planner
          </h1>
          <div className="flex gap-1">
             <Button variant={activeTab === 'route' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('route')}>
                <MapPin className="h-4 w-4" />
             </Button>
             <Button variant={activeTab === 'vehicle' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('vehicle')}>
                <Car className="h-4 w-4" />
             </Button>
             <Button variant={activeTab === 'settings' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('settings')}>
                <SettingsIcon className="h-4 w-4" />
             </Button>
             <Button variant={activeTab === 'history' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('history')}>
                <History className="h-4 w-4" />
             </Button>
             <Button variant={activeTab === 'itinerary' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('itinerary')}>
                <Calendar className="h-4 w-4" />
             </Button>
          </div>
        </div>

        {/* Map Layers Control (Mini) */}
        <div className="px-4 py-2 border-b bg-muted/20 flex gap-2 overflow-x-auto no-scrollbar items-center md:h-auto h-12">
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

        {error && (
            <div className="mx-4 mt-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-2">
                <span className="font-bold">Error:</span> {error}
                <button onClick={() => setError(null)} className="ml-auto font-bold">×</button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <Card className="border-0 shadow-none">
             <CardHeader className="px-0 pt-0">
                <CardTitle className="flex justify-between items-center">
                    <span>
                    {activeTab === 'route' && "Plan Your Route"}
                    {activeTab === 'vehicle' && "Vehicle Details"}
                    {activeTab === 'settings' && "Trip Settings"}
                    {activeTab === 'history' && "Recent Trips"}
                    {activeTab === 'itinerary' && "Detailed Itinerary"}
                    </span>
                    {shareUrl && activeTab === 'route' && (
                        <Button size="sm" variant="ghost" className="h-6 gap-1 text-blue-600" onClick={copyShareLink}>
                            <Share2 className="h-3 w-3" /> Share
                        </Button>
                    )}
                </CardTitle>
             </CardHeader>
             <CardContent className="px-0">
                {activeTab === 'route' && (
                    <LocationList 
                        locations={locations} 
                        setLocations={setLocations} 
                        onCalculate={handleCalculate}
                        isCalculating={isCalculating}
                    />
                )}
                {activeTab === 'vehicle' && (
                    <VehicleForm
                      vehicle={vehicle}
                      setVehicle={setVehicle}
                      units={settings.units}
                      setUnits={(value) => setSettings(prev => ({
                        ...prev, 
                        units: typeof value === 'function' ? value(prev.units) : value 
                      }))}
                    />
                )}
                {activeTab === 'settings' && (
                    <SettingsForm settings={settings} setSettings={setSettings} />
                )}
                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {history.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-8">
                                No recent trips found.
                            </div>
                        ) : (
                            history.map((trip, i) => (
                                <div key={i} className="p-3 border rounded-lg bg-muted/20 text-sm hover:bg-muted/30 transition-colors">
                                    <div className="font-semibold mb-1 flex justify-between">
                                        <span>Trip {i + 1}</span>
                                        <div className="text-xs font-normal text-muted-foreground">{trip.displayDate && new Date(trip.displayDate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="text-muted-foreground">
                                        {trip.totalDistanceKm.toFixed(0)} km • {Math.floor(trip.totalDurationMinutes / 60)}h {trip.totalDurationMinutes % 60}m
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 font-medium text-green-600">
                                        Est. Cost: ${trip.totalFuelCost.toFixed(2)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
                {activeTab === 'itinerary' && summary && (
                    <ItineraryTimeline summary={summary} settings={settings} />
                )}
                {activeTab === 'itinerary' && !summary && (
                     <div className="text-center py-12 text-muted-foreground">
                         <div className="mb-2">🗺️</div>
                         Calculated route required to view itinerary.
                         <Button variant="link" onClick={() => setActiveTab('route')} className="block mx-auto mt-2">
                             Go to Plan Route
                         </Button>
                     </div>
                )}
             </CardContent>
          </Card>
        </div>
        
        <div className="p-4 border-t text-xs text-muted-foreground text-center hidden md:block">
            Built with React, Leaflet & OSRM
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
        
        {summary && (
            <TripSummaryCard
                summary={summary}
                settings={settings}
                tripActive={tripActive}
                onStop={() => setTripActive(false)}
                onOpenVehicleTab={() => setActiveTab('vehicle')}
            />
        )}
      </div>
    </div>
  );
}

export default App;

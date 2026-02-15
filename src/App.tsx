import { useState } from 'react';
import { Map } from './components/Map/Map';
import { LocationList } from './components/Trip/LocationList';
import { VehicleForm } from './components/Vehicle/VehicleForm';
import { SettingsForm } from './components/Settings/SettingsForm';
import { TripSummaryCard } from './components/Trip/TripSummary';
import { Button } from './components/UI/Button';
import { Card, CardContent, CardHeader, CardTitle } from './components/UI/Card';
import type { Location, Vehicle, TripSettings, TripSummary } from './types';
import { calculateRoute } from './lib/api';
import { calculateTripCosts } from './lib/calculations';
import { MapPin, Settings as SettingsIcon, Car } from 'lucide-react';
// import { cn } from './lib/utils';

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
};

type Tab = 'route' | 'vehicle' | 'settings' | 'info';

function App() {
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [vehicle, setVehicle] = useState<Vehicle>(DEFAULT_VEHICLE);
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('route');
  const [isCalculating, setIsCalculating] = useState(false);
  const [tripActive, setTripActive] = useState(false);

  const handleCalculate = async () => {
    setIsCalculating(true);
    const routeData = await calculateRoute(locations);
    
    if (routeData) {
      const tripSummary = calculateTripCosts(routeData.segments, vehicle, settings);
      tripSummary.fullGeometry = routeData.fullGeometry;
      setSummary(tripSummary);
    }
    setIsCalculating(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-full md:w-[400px] flex flex-col border-r bg-card z-10 shadow-xl">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Roadtrip Planner
          </h1>
          <div className="flex gap-1">
             {/* Tab Buttons */}
             <Button variant={activeTab === 'route' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('route')}>
                <MapPin className="h-4 w-4" />
             </Button>
             <Button variant={activeTab === 'vehicle' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('vehicle')}>
                <Car className="h-4 w-4" />
             </Button>
             <Button variant={activeTab === 'settings' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab('settings')}>
                <SettingsIcon className="h-4 w-4" />
             </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <Card className="border-0 shadow-none">
             <CardHeader className="px-0 pt-0">
                <CardTitle>
                    {activeTab === 'route' && "Plan Your Route"}
                    {activeTab === 'vehicle' && "Vehicle Details"}
                    {activeTab === 'settings' && "Trip Settings"}
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
                    <VehicleForm vehicle={vehicle} setVehicle={setVehicle} units={settings.units} />
                )}
                {activeTab === 'settings' && (
                    <SettingsForm settings={settings} setSettings={setSettings} />
                )}
             </CardContent>
          </Card>
        </div>
        
        {/* Footer info/credits */}
        <div className="p-4 border-t text-xs text-muted-foreground text-center">
            Built with React, Leaflet & OSRM
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        <Map 
            locations={locations} 
            routeGeometry={summary?.fullGeometry as [number, number][] || null} 
            markerCategories={[]} 
            tripActive={tripActive}
        />
        
        {summary && (
            <TripSummaryCard 
                summary={summary} 
                settings={settings} 
                tripActive={tripActive}
                onStop={() => setTripActive(false)}
            />
        )}
      </div>
    </div>
  );
}

export default App;

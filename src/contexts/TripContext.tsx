import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, TripBudget } from '../types';
import { DEFAULT_BUDGET } from '../lib/budget';
import { getDefaultVehicleId, getGarage } from '../lib/storage';

// ==================== DEFAULT VALUES ====================

export const DEFAULT_LOCATIONS: Location[] = [
  { id: 'origin', name: '', lat: 0, lng: 0, type: 'origin' },
  { id: 'dest', name: '', lat: 0, lng: 0, type: 'destination' },
];

export const DEFAULT_VEHICLE: Vehicle = {
  year: '2024',
  make: 'Toyota',
  model: 'Camry',
  fuelEconomyCity: 8.7,
  fuelEconomyHwy: 6.2,
  tankSize: 60,
};

export const DEFAULT_SETTINGS: TripSettings = {
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
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
  isRoundTrip: true,
  avoidTolls: false,
  scenicMode: false,
  routePreference: 'fastest',
  stopFrequency: 'balanced',
  tripPreferences: [],
};

// ==================== CONTEXT TYPE ====================

interface TripContextType {
  // Core State
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;
  summary: TripSummary | null;

  // Core Setters
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  setSummary: React.Dispatch<React.SetStateAction<TripSummary | null>>;

  // Location Helpers
  updateLocation: (index: number, updates: Partial<Location>) => void;
  addWaypoint: () => void;
  removeLocation: (index: number) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;

  // Budget Helpers
  updateBudget: (updates: Partial<TripBudget>) => void;

  // Reset
  resetTrip: () => void;
}

// ==================== CONTEXT ====================

const TripContext = createContext<TripContextType | null>(null);

// ==================== PROVIDER ====================

interface TripProviderProps {
  children: ReactNode;
  initialLocations?: Location[];
  initialVehicle?: Vehicle;
  initialSettings?: TripSettings;
}

export function TripProvider({
  children,
  initialLocations,
  initialVehicle,
  initialSettings,
}: TripProviderProps) {
  // Core State
  const [locations, setLocations] = useState<Location[]>(initialLocations || DEFAULT_LOCATIONS);
  const [vehicle, setVehicle] = useState<Vehicle>(() => {
    // Try to load default vehicle from garage
    if (initialVehicle) return initialVehicle;
    const defaultId = getDefaultVehicleId();
    if (defaultId) {
      const garage = getGarage();
      const defaultVehicle = garage.find(v => v.id === defaultId);
      if (defaultVehicle) return defaultVehicle;
    }
    return DEFAULT_VEHICLE;
  });
  const [settings, setSettings] = useState<TripSettings>(initialSettings || DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<TripSummary | null>(null);

  // Location Helpers
  const updateLocation = useCallback((index: number, updates: Partial<Location>) => {
    setLocations(prev => prev.map((loc, i) =>
      i === index ? { ...loc, ...updates } : loc
    ));
  }, []);

  const addWaypoint = useCallback(() => {
    setLocations(prev => {
      const newWaypoint: Location = {
        id: `waypoint-${Date.now()}`,
        name: '',
        lat: 0,
        lng: 0,
        type: 'waypoint',
      };
      // Insert before destination
      const newLocations = [...prev];
      newLocations.splice(newLocations.length - 1, 0, newWaypoint);
      return newLocations;
    });
  }, []);

  const removeLocation = useCallback((index: number) => {
    setLocations(prev => {
      // Don't allow removing origin or destination
      if (prev[index].type === 'origin' || prev[index].type === 'destination') {
        // Instead, clear the location
        return prev.map((loc, i) =>
          i === index ? { ...loc, name: '', lat: 0, lng: 0 } : loc
        );
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const reorderLocations = useCallback((fromIndex: number, toIndex: number) => {
    setLocations(prev => {
      const newLocations = [...prev];
      const [removed] = newLocations.splice(fromIndex, 1);
      newLocations.splice(toIndex, 0, removed);
      return newLocations;
    });
  }, []);

  // Budget Helpers
  const updateBudget = useCallback((updates: Partial<TripBudget>) => {
    setSettings(prev => ({
      ...prev,
      budget: { ...prev.budget, ...updates },
    }));
  }, []);

  // Reset
  const resetTrip = useCallback(() => {
    setLocations(DEFAULT_LOCATIONS);
    setSettings(DEFAULT_SETTINGS);
    setSummary(null);
  }, []);

  const value: TripContextType = {
    locations,
    vehicle,
    settings,
    summary,
    setLocations,
    setVehicle,
    setSettings,
    setSummary,
    updateLocation,
    addWaypoint,
    removeLocation,
    reorderLocations,
    updateBudget,
    resetTrip,
  };

  return (
    <TripContext.Provider value={value}>
      {children}
    </TripContext.Provider>
  );
}

// ==================== HOOK ====================

export function useTripContext() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTripContext must be used within a TripProvider');
  }
  return context;
}

// Also export a hook that doesn't throw (for optional usage)
export function useTripContextOptional() {
  return useContext(TripContext);
}

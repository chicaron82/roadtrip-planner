// Context files intentionally export both the provider component and hooks/constants
// in the same file. Splitting them would scatter the API across multiple files.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, TripBudget, Activity, DayType, OvernightStop, TripDay } from '../types';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import { DEFAULT_BUDGET } from '../lib/budget';
import { getDefaultVehicleId, getGarage, loadSettingsDefaults, saveSettingsDefaults } from '../lib/storage';
import { formatLocalYMD } from '../lib/utils';
import { getFuelPriceDefault } from '../lib/regional-costs';
import {
  addDayActivity as canonicalAddDayActivity,
  updateDayActivity as canonicalUpdateDayActivity,
  removeDayActivity as canonicalRemoveDayActivity,
  updateDayNotes as canonicalUpdateDayNotes,
  updateDayTitle as canonicalUpdateDayTitle,
  updateDayType as canonicalUpdateDayType,
  updateOvernight as canonicalUpdateOvernight,
} from '../lib/canonical-updates';

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
  departureDate: formatLocalYMD(),
  departureTime: '09:00',
  returnDate: '',
  arrivalDate: '',
  arrivalTime: '',
  useArrivalTime: false,
  gasPrice: 1.50,
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
  isRoundTrip: true,
  avoidTolls: false,
  avoidBorders: false,
  scenicMode: false,
  routePreference: 'fastest',
  stopFrequency: 'balanced',
  tripPreferences: [],
  targetArrivalHour: 21,
  dayTripDurationHours: 0,
};

// ==================== CONTEXT TYPE ====================

interface TripContextType {
  // Core State
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;
  summary: TripSummary | null;
  /** Canonical trip timeline (set after a successful calculation). Promoted to context
   *  so deep consumers (Step3, SmartTimeline) can read it without prop drilling. */
  canonicalTimeline: CanonicalTripTimeline | null;

  // Core Setters
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  setSummary: React.Dispatch<React.SetStateAction<TripSummary | null>>;
  setCanonicalTimeline: React.Dispatch<React.SetStateAction<CanonicalTripTimeline | null>>;

  // Location Helpers
  updateLocation: (index: number, updates: Partial<Location>) => void;
  addWaypoint: () => void;
  removeLocation: (index: number) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;

  // Budget Helpers
  updateBudget: (updates: Partial<TripBudget>) => void;

  // Day Mutation Helpers (all route through canonical-updates pure functions)
  addDayActivity: (dayNumber: number, activity: Activity) => void;
  updateDayActivity: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  removeDayActivity: (dayNumber: number, activityIndex: number) => void;
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: OvernightStop) => void;
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
  const [settings, setSettings] = useState<TripSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadSettingsDefaults(),
    ...(initialSettings || {}),
  }));
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [canonicalTimeline, setCanonicalTimeline] = useState<CanonicalTripTimeline | null>(null);

  // Auto-persist preference fields whenever settings change
  useEffect(() => {
    saveSettingsDefaults(settings);
  }, [settings]);

  // Auto-populate gasPrice from regional data when origin changes.
  // Uses a ref to track the last auto-set value so user overrides are respected.
  const lastAutoFuelPrice = useRef<number | null>(null);
  const originName = locations.find(l => l.type === 'origin')?.name ?? '';
  useEffect(() => {
    if (!originName) return;
    const suggested = getFuelPriceDefault(originName, settings.currency);
    if (suggested === null) return;
    setSettings(prev => {
      // If the user has manually changed gasPrice since our last auto-set, leave it alone.
      const userModified = lastAutoFuelPrice.current !== null && prev.gasPrice !== lastAutoFuelPrice.current;
      if (userModified) return prev;
      lastAutoFuelPrice.current = suggested;
      return { ...prev, gasPrice: suggested };
    });
  }, [originName, settings.currency]);

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

  // Day Mutation Helpers — all use canonical-updates pure functions as the
  // single source of mutation rules. setSummary is the state write target
  // until the context split (B2) promotes canonicalTimeline.days as primary.
  const patchSummaryDays = useCallback((patcher: (days: TripDay[]) => TripDay[]) => {
    setSummary(prev => {
      if (!prev?.days) return prev;
      const next = patcher(prev.days);
      return next === prev.days ? prev : { ...prev, days: next };
    });
  }, []);

  const addDayActivity = useCallback((dayNumber: number, activity: Activity) => {
    patchSummaryDays(days => canonicalAddDayActivity(days, dayNumber, activity));
  }, [patchSummaryDays]);

  const updateDayActivity = useCallback((dayNumber: number, activityIndex: number, activity: Activity) => {
    patchSummaryDays(days => canonicalUpdateDayActivity(days, dayNumber, activityIndex, activity));
  }, [patchSummaryDays]);

  const removeDayActivity = useCallback((dayNumber: number, activityIndex: number) => {
    patchSummaryDays(days => canonicalRemoveDayActivity(days, dayNumber, activityIndex));
  }, [patchSummaryDays]);

  const updateDayNotes = useCallback((dayNumber: number, notes: string) => {
    patchSummaryDays(days => canonicalUpdateDayNotes(days, dayNumber, notes));
  }, [patchSummaryDays]);

  const updateDayTitle = useCallback((dayNumber: number, title: string) => {
    patchSummaryDays(days => canonicalUpdateDayTitle(days, dayNumber, title));
  }, [patchSummaryDays]);

  const updateDayType = useCallback((dayNumber: number, dayType: DayType) => {
    patchSummaryDays(days => canonicalUpdateDayType(days, dayNumber, dayType));
  }, [patchSummaryDays]);

  const updateDayOvernight = useCallback((dayNumber: number, overnight: OvernightStop) => {
    patchSummaryDays(days => canonicalUpdateOvernight(days, dayNumber, overnight));
  }, [patchSummaryDays]);

  // Memoize so consumers only re-render when state they care about changes,
  // not on every unrelated TripProvider render.
  // TODO: split into TripCoreContext + TimelineContext once the Step 3 / Viewer
  //       refactor defines clear consumer boundaries (per arch ticket backlog).
  const value = useMemo<TripContextType>(() => ({
    locations,
    vehicle,
    settings,
    summary,
    canonicalTimeline,
    setLocations,
    setVehicle,
    setSettings,
    setSummary,
    setCanonicalTimeline,
    updateLocation,
    addWaypoint,
    removeLocation,
    reorderLocations,
    updateBudget,
    addDayActivity,
    updateDayActivity,
    removeDayActivity,
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
  }), [
    locations, vehicle, settings, summary, canonicalTimeline,
    setLocations, setVehicle, setSettings, setSummary, setCanonicalTimeline,
    updateLocation, addWaypoint, removeLocation, reorderLocations,
    updateBudget, addDayActivity, updateDayActivity, removeDayActivity,
    updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight,
  ]);

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

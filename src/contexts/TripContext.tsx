// Context files intentionally export both the provider component and hooks/constants
// in the same file. Splitting them would scatter the API across multiple files.
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useDebounce } from '../hooks/useDebounce';
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

// ==================== CORE CONTEXT ====================
// Owns: locations, vehicle, settings — the "input" side of trip planning.

interface TripCoreContextType {
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;

  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;

  updateLocation: (index: number, updates: Partial<Location>) => void;
  addWaypoint: () => void;
  removeLocation: (index: number) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateBudget: (updates: Partial<TripBudget>) => void;
}

const TripCoreContext = createContext<TripCoreContextType | null>(null);

// ==================== TIMELINE CONTEXT ====================
// Owns: summary, canonicalTimeline — the "output" side + all day mutations.

interface TimelineContextType {
  summary: TripSummary | null;
  /** Canonical trip timeline (set after a successful calculation). */
  canonicalTimeline: CanonicalTripTimeline | null;

  setSummary: React.Dispatch<React.SetStateAction<TripSummary | null>>;
  setCanonicalTimeline: React.Dispatch<React.SetStateAction<CanonicalTripTimeline | null>>;

  /** Day mutation helpers — all route through canonical-updates pure functions. */
  addDayActivity: (dayNumber: number, activity: Activity) => void;
  updateDayActivity: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  removeDayActivity: (dayNumber: number, activityIndex: number) => void;
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: OvernightStop) => void;
}

const TimelineContext = createContext<TimelineContextType | null>(null);

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
  // ── Core State ─────────────────────────────────────────────────────────────
  const [locations, setLocations] = useState<Location[]>(initialLocations || DEFAULT_LOCATIONS);
  const [vehicle, setVehicle] = useState<Vehicle>(() => {
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

  // ── Timeline State ──────────────────────────────────────────────────────────
  const [summaryState, setSummaryState] = useState<TripSummary | null>(null);
  const [canonicalTimelineState, setCanonicalTimelineState] = useState<CanonicalTripTimeline | null>(null);
  const summaryRef = useRef<TripSummary | null>(summaryState);
  const canonicalTimelineRef = useRef<CanonicalTripTimeline | null>(canonicalTimelineState);

  useEffect(() => {
    summaryRef.current = summaryState;
  }, [summaryState]);

  useEffect(() => {
    canonicalTimelineRef.current = canonicalTimelineState;
  }, [canonicalTimelineState]);

  const setSummary: React.Dispatch<React.SetStateAction<TripSummary | null>> = useCallback((nextSummaryAction) => {
    const prevSummary = summaryRef.current;
    const nextSummary = typeof nextSummaryAction === 'function'
      ? nextSummaryAction(prevSummary)
      : nextSummaryAction;

    summaryRef.current = nextSummary;
    setSummaryState(nextSummary);

    const prevTimeline = canonicalTimelineRef.current;
    if (!prevTimeline) return;

    const nextTimeline = nextSummary
      ? { ...prevTimeline, summary: nextSummary }
      : null;

    canonicalTimelineRef.current = nextTimeline;
    setCanonicalTimelineState(nextTimeline);
  }, []);

  const setCanonicalTimeline: React.Dispatch<React.SetStateAction<CanonicalTripTimeline | null>> = useCallback((nextTimelineAction) => {
    const prevTimeline = canonicalTimelineRef.current;
    const nextTimeline = typeof nextTimelineAction === 'function'
      ? nextTimelineAction(prevTimeline)
      : nextTimelineAction;

    canonicalTimelineRef.current = nextTimeline;
    setCanonicalTimelineState(nextTimeline);

    const nextSummary = nextTimeline?.summary ?? null;
    summaryRef.current = nextSummary;
    setSummaryState(nextSummary);
  }, []);

  // ── Core side-effects ───────────────────────────────────────────────────────
  const debouncedSettings = useDebounce(settings, 500);

  useEffect(() => {
    saveSettingsDefaults(debouncedSettings);
  }, [debouncedSettings]);

  // Auto-populate gasPrice from regional data when origin changes.
  const lastAutoFuelPrice = useRef<number | null>(null);
  const originName = locations.find(l => l.type === 'origin')?.name ?? '';
  useEffect(() => {
    if (!originName) return;
    const suggested = getFuelPriceDefault(originName, settings.currency);
    if (suggested === null) return;
    setSettings(prev => {
      const userModified = lastAutoFuelPrice.current !== null && prev.gasPrice !== lastAutoFuelPrice.current;
      if (userModified) return prev;
      lastAutoFuelPrice.current = suggested;
      return { ...prev, gasPrice: suggested };
    });
  }, [originName, settings.currency]);

  // ── Core Helpers ────────────────────────────────────────────────────────────
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
      const newLocations = [...prev];
      newLocations.splice(newLocations.length - 1, 0, newWaypoint);
      return newLocations;
    });
  }, []);

  const removeLocation = useCallback((index: number) => {
    setLocations(prev => {
      if (prev[index].type === 'origin' || prev[index].type === 'destination') {
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

  const updateBudget = useCallback((updates: Partial<TripBudget>) => {
    setSettings(prev => ({
      ...prev,
      budget: { ...prev.budget, ...updates },
    }));
  }, []);

  // ── Timeline / Day Mutation Helpers ─────────────────────────────────────────
  // All route through canonical-updates pure functions.
  // Bridge state keeps summary and canonicalTimeline.summary synchronized until
  // the broader canonical-first migration removes the duplicate summary state.
  const patchSummaryDays = useCallback((patcher: (days: TripDay[]) => TripDay[]) => {
    setSummary(prev => {
      if (!prev?.days) return prev;
      const next = patcher(prev.days);
      return next === prev.days ? prev : { ...prev, days: next };
    });
  }, [setSummary]);

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

  // ── Memoized context values ─────────────────────────────────────────────────
  const coreValue = useMemo<TripCoreContextType>(() => ({
    locations, vehicle, settings,
    setLocations, setVehicle, setSettings,
    updateLocation, addWaypoint, removeLocation, reorderLocations, updateBudget,
  }), [
    locations, vehicle, settings,
    setLocations, setVehicle, setSettings,
    updateLocation, addWaypoint, removeLocation, reorderLocations, updateBudget,
  ]);

  const timelineValue = useMemo<TimelineContextType>(() => ({
    summary: summaryState, canonicalTimeline: canonicalTimelineState,
    setSummary, setCanonicalTimeline,
    addDayActivity, updateDayActivity, removeDayActivity,
    updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight,
  }), [
    summaryState, canonicalTimelineState,
    setSummary, setCanonicalTimeline,
    addDayActivity, updateDayActivity, removeDayActivity,
    updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight,
  ]);

  return (
    <TripCoreContext.Provider value={coreValue}>
      <TimelineContext.Provider value={timelineValue}>
        {children}
      </TimelineContext.Provider>
    </TripCoreContext.Provider>
  );
}

// ==================== FOCUSED HOOKS ====================

/** Read from the core (input) slice: locations, vehicle, settings. */
export function useTripCore(): TripCoreContextType {
  const ctx = useContext(TripCoreContext);
  if (!ctx) throw new Error('useTripCore must be used within a TripProvider');
  return ctx;
}

/** Read from the timeline (output) slice: summary, canonicalTimeline, day mutations. */
export function useTimeline(): TimelineContextType {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('useTimeline must be used within a TripProvider');
  return ctx;
}

// ==================== SHIM HOOKS ====================
// Keep the old useTripContext() API alive so App.tsx doesn't need to split its
// destructure today. Consumers that only need one slice should prefer the
// focused hooks above for better render isolation.

/** @deprecated Prefer useTripCore() or useTimeline() for better render isolation. */
export function useTripContext() {
  const core = useTripCore();
  const timeline = useTimeline();
  return useMemo(() => ({ ...core, ...timeline }), [core, timeline]);
}

/** Optional variant — returns null if called outside TripProvider. */
export function useTripContextOptional() {
  const core = useContext(TripCoreContext);
  const timeline = useContext(TimelineContext);
  if (!core || !timeline) return null;
  return { ...core, ...timeline };
}

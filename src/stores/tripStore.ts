import { create } from 'zustand';
import type { Location, Vehicle, TripSettings, TripSummary, TripBudget, Activity, DayType, OvernightStop } from '../types';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import { DEFAULT_BUDGET } from '../lib/budget';
import { getDefaultVehicleId, getGarage, loadSettingsDefaults } from '../lib/storage';
import { formatLocalYMD } from '../lib/utils';
import {
  addDayActivity as canonicalAddDayActivity,
  updateDayActivity as canonicalUpdateDayActivity,
  removeDayActivity as canonicalRemoveDayActivity,
  updateDayNotes as canonicalUpdateDayNotes,
  updateDayTitle as canonicalUpdateDayTitle,
  updateDayType as canonicalUpdateDayType,
  updateOvernight as canonicalUpdateOvernight,
} from '../lib/canonical-updates';

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

function getInitialVehicle(initialVehicle?: Vehicle) {
  if (initialVehicle) return initialVehicle;
  const defaultId = getDefaultVehicleId();
  if (defaultId) {
    const garage = getGarage();
    const defaultVehicle = garage.find(v => v.id === defaultId);
    if (defaultVehicle) return defaultVehicle;
  }
  return DEFAULT_VEHICLE;
}

export interface TripState {
  // Core
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;

  // Timeline
  summary: TripSummary | null;
  canonicalTimeline: CanonicalTripTimeline | null;

  // Actions: Core
  setLocations: (locations: Location[] | ((prev: Location[]) => Location[])) => void;
  setVehicle: (vehicle: Vehicle | ((prev: Vehicle) => Vehicle)) => void;
  setSettings: (settings: TripSettings | ((prev: TripSettings) => TripSettings)) => void;
  
  updateLocation: (index: number, updates: Partial<Location>) => void;
  addWaypoint: () => void;
  removeLocation: (index: number) => void;
  reorderLocations: (fromIndex: number, toIndex: number) => void;
  updateBudget: (updates: Partial<TripBudget>) => void;

  // Actions: Timeline
  setSummary: (summary: TripSummary | null | ((prev: TripSummary | null) => TripSummary | null)) => void;
  setCanonicalTimeline: (timeline: CanonicalTripTimeline | null | ((prev: CanonicalTripTimeline | null) => CanonicalTripTimeline | null)) => void;

  addDayActivity: (dayNumber: number, activity: Activity) => void;
  updateDayActivity: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  removeDayActivity: (dayNumber: number, activityIndex: number) => void;
  updateDayNotes: (dayNumber: number, notes: string) => void;
  updateDayTitle: (dayNumber: number, title: string) => void;
  updateDayType: (dayNumber: number, dayType: DayType) => void;
  updateDayOvernight: (dayNumber: number, overnight: OvernightStop) => void;
}

export const useTripStore = create<TripState>((set) => ({
  locations: DEFAULT_LOCATIONS,
  vehicle: getInitialVehicle(),
  settings: { ...DEFAULT_SETTINGS, ...loadSettingsDefaults() },
  summary: null,
  canonicalTimeline: null,

  setLocations: (updater) => set((state) => ({
    locations: typeof updater === 'function' ? updater(state.locations) : updater,
  })),
  setVehicle: (updater) => set((state) => ({
    vehicle: typeof updater === 'function' ? updater(state.vehicle) : updater,
  })),
  setSettings: (updater) => set((state) => ({
    settings: typeof updater === 'function' ? updater(state.settings) : updater,
  })),
  
  updateLocation: (index, updates) => set((state) => ({
    locations: state.locations.map((loc, i) => i === index ? { ...loc, ...updates } : loc),
  })),
  addWaypoint: () => set((state) => {
    const newWaypoint: Location = { id: `waypoint-${Date.now()}`, name: '', lat: 0, lng: 0, type: 'waypoint' };
    const prev = state.locations;
    return { locations: [...prev.slice(0, prev.length - 1), newWaypoint, prev[prev.length - 1]] };
  }),
  removeLocation: (index) => set((state) => {
    const prev = state.locations;
    if (prev[index].type === 'origin' || prev[index].type === 'destination') {
      return { locations: prev.map((loc, i) => i === index ? { ...loc, name: '', lat: 0, lng: 0 } : loc) };
    }
    return { locations: prev.filter((_, i) => i !== index) };
  }),
  reorderLocations: (fromIndex, toIndex) => set((state) => {
    const newLocations = [...state.locations];
    const [removed] = newLocations.splice(fromIndex, 1);
    newLocations.splice(toIndex, 0, removed);
    return { locations: newLocations };
  }),
  updateBudget: (updates) => set((state) => ({
    settings: { ...state.settings, budget: { ...state.settings.budget, ...updates } },
  })),

  setSummary: (updater) => set((state) => {
    const nextSummary = typeof updater === 'function' ? updater(state.summary) : updater;
    if (!state.canonicalTimeline && nextSummary === null) {
      return { summary: null, canonicalTimeline: null };
    }
    if (!state.canonicalTimeline) {
      // should ideally not happen but fallback
      return { summary: nextSummary };
    }
    const nextTimeline = nextSummary ? { ...state.canonicalTimeline, summary: nextSummary } : null;
    return { summary: nextSummary, canonicalTimeline: nextTimeline };
  }),
  
  setCanonicalTimeline: (updater) => set((state) => {
    const nextTimeline = typeof updater === 'function' ? updater(state.canonicalTimeline) : updater;
    return { canonicalTimeline: nextTimeline, summary: nextTimeline?.summary ?? state.summary };
  }),

  // Helpers
  addDayActivity: (dayNumber, activity) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalAddDayActivity(state.summary.days, dayNumber, activity);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
  updateDayActivity: (dayNumber, activityIndex, activity) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalUpdateDayActivity(state.summary.days, dayNumber, activityIndex, activity);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
  removeDayActivity: (dayNumber, activityIndex) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalRemoveDayActivity(state.summary.days, dayNumber, activityIndex);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
  updateDayNotes: (dayNumber, notes) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalUpdateDayNotes(state.summary.days, dayNumber, notes);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
  updateDayTitle: (dayNumber, title) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalUpdateDayTitle(state.summary.days, dayNumber, title);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
  updateDayType: (dayNumber, dayType) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalUpdateDayType(state.summary.days, dayNumber, dayType);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
  updateDayOvernight: (dayNumber, overnight) => set(state => {
    if (!state.summary?.days) return state;
    const nextDays = canonicalUpdateOvernight(state.summary.days, dayNumber, overnight);
    return nextDays === state.summary.days ? state : { summary: { ...state.summary, days: nextDays } };
  }),
}));

/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDebounce } from '../hooks/useDebounce';
import type { Location, Vehicle, TripSettings, TripSummary } from '../types';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import { saveSettingsDefaults } from '../lib/storage';
import { getFuelPriceDefault } from '../lib/regional-costs';
import { useTripStore, type TripState, DEFAULT_LOCATIONS, DEFAULT_VEHICLE, DEFAULT_SETTINGS } from '../stores/tripStore';

// Expose default constants for consumers
export { DEFAULT_LOCATIONS, DEFAULT_VEHICLE, DEFAULT_SETTINGS };

// ==================== CORE ====================
// Owns: locations, vehicle, settings — the "input" side of trip planning.

export interface TripCoreContextType {
  locations: Location[];
  vehicle: Vehicle;
  settings: TripSettings;
  customTitle: string | null;

  setLocations: TripState['setLocations'];
  setVehicle: TripState['setVehicle'];
  setSettings: TripState['setSettings'];
  setCustomTitle: TripState['setCustomTitle'];

  updateLocation: TripState['updateLocation'];
  addWaypoint: TripState['addWaypoint'];
  removeLocation: TripState['removeLocation'];
  reorderLocations: TripState['reorderLocations'];
  updateBudget: TripState['updateBudget'];
}

// ==================== TIMELINE ====================
// Owns: summary, canonicalTimeline — the "output" side + all day mutations.

export interface TimelineContextType {
  summary: TripSummary | null;
  canonicalTimeline: CanonicalTripTimeline | null;

  setSummary: TripState['setSummary'];
  setCanonicalTimeline: TripState['setCanonicalTimeline'];

  addDayActivity: TripState['addDayActivity'];
  updateDayActivity: TripState['updateDayActivity'];
  removeDayActivity: TripState['removeDayActivity'];
  updateDayNotes: TripState['updateDayNotes'];
  updateDayTitle: TripState['updateDayTitle'];
  updateDayType: TripState['updateDayType'];
  updateDayOvernight: TripState['updateDayOvernight'];
}

// ==================== PROVIDER (SIDE EFFECTS ONLY) ====================

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
  const { setLocations, setVehicle, setSettings, settings, locations } = useTripCore();

  // Initialize store if props are provided on mount
  const isInitialized = useRef(false);
  useEffect(() => {
    if (isInitialized.current) return;
    if (initialLocations) setLocations(initialLocations);
    if (initialVehicle) setVehicle(initialVehicle);
    if (initialSettings) setSettings(prev => ({ ...prev, ...initialSettings }));
    isInitialized.current = true;
  }, [initialLocations, initialVehicle, initialSettings, setLocations, setVehicle, setSettings]);

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
  }, [originName, settings.currency, setSettings]);

  return <>{children}</>;
}

// ==================== FOCUSED HOOKS ====================

/** Read from the core (input) slice: locations, vehicle, settings. */
export function useTripCore(): TripCoreContextType {
  return useTripStore(useShallow(state => ({
    locations: state.locations,
    vehicle: state.vehicle,
    settings: state.settings,
    customTitle: state.customTitle,
    setLocations: state.setLocations,
    setVehicle: state.setVehicle,
    setSettings: state.setSettings,
    setCustomTitle: state.setCustomTitle,
    updateLocation: state.updateLocation,
    addWaypoint: state.addWaypoint,
    removeLocation: state.removeLocation,
    reorderLocations: state.reorderLocations,
    updateBudget: state.updateBudget,
  })));
}

/** Read from the timeline (output) slice: summary, canonicalTimeline, day mutations. */
export function useTimeline(): TimelineContextType {
  return useTripStore(useShallow(state => ({
    summary: state.summary,
    canonicalTimeline: state.canonicalTimeline,
    setSummary: state.setSummary,
    setCanonicalTimeline: state.setCanonicalTimeline,
    addDayActivity: state.addDayActivity,
    updateDayActivity: state.updateDayActivity,
    removeDayActivity: state.removeDayActivity,
    updateDayNotes: state.updateDayNotes,
    updateDayTitle: state.updateDayTitle,
    updateDayType: state.updateDayType,
    updateDayOvernight: state.updateDayOvernight,
  })));
}

// ==================== SHIM HOOKS ====================
// Keep the old useTripContext() API alive so App.tsx doesn't need to split its
// destructure today. Consumers that only need one slice should prefer the
// focused hooks above for better render isolation.

/** @deprecated Prefer useTripCore() or useTimeline() for better render isolation. */
export function useTripContext() {
  const core = useTripCore();
  const timeline = useTimeline();
  return { ...core, ...timeline };
}

/** Optional variant — returns everything since we no longer lack a React Context boundary. */
export function useTripContextOptional() {
  return useTripContext();
}

import type { Location, TripSummary, TripSettings, HistoryTripSnapshot } from '../types';

const KEYS = {
  FAVORITES: 'roadtrip_favorites',
  HISTORY: 'roadtrip_history',
  SETTINGS: 'roadtrip_settings',
  LAST_ORIGIN: 'roadtrip_last_origin',
  DEFAULT_SETTINGS: 'roadtrip_default_settings',
};

// Re-export vehicle/garage storage (moved to storage-garage.ts)
export type { SavedVehicle } from './storage-garage';
export {
  getGarage,
  saveToGarage,
  removeFromGarage,
  getDefaultVehicleId,
  setDefaultVehicleId,
  getDefaultVehicle,
} from './storage-garage';

// Re-export budget profile + last-trip storage (moved to storage-budget.ts)
export {
  getBudgetProfiles,
  saveBudgetProfile,
  removeBudgetProfile,
  setDefaultBudgetProfile,
  getLastTripBudget,
} from './storage-budget';

export interface SavedLocation extends Location {
  isFavorite?: boolean;
}

export const getFavorites = (): SavedLocation[] => {
  try {
    const data = localStorage.getItem(KEYS.FAVORITES);
    return data ? JSON.parse(data) : [];
  } catch { 
    return []; 
  }
};

export const toggleFavorite = (location: Location) => {
  let favorites = getFavorites();
  const exists = favorites.find(f => f.name === location.name && f.lat === location.lat && f.lng === location.lng);

  if (exists) {
    favorites = favorites.filter(f => !(f.name === location.name && f.lat === location.lat && f.lng === location.lng));
  } else {
    favorites.push({ ...location, isFavorite: true });
  }
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.warn('Failed to save favorites', e);
  }
  return favorites;
};

// --- History (Trips) ---
// We store a simplified snapshot to avoid hitting storage limits with massive geometry arrays
export const getHistory = (): HistoryTripSnapshot[] => {
    try {
        const data = localStorage.getItem(KEYS.HISTORY);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
};

export const addToHistory = (summary: TripSummary, locations: Location[], isRoundTrip: boolean, waypointCount: number) => {
    const history = getHistory();
    
    // Create a lightweight snapshot for the UI
    const snapshot: HistoryTripSnapshot = {
      id: `trip-${Date.now()}`,
      savedAt: new Date().toISOString(),
      locations: locations,
      totalDistanceKm: summary.totalDistanceKm,
      totalDurationMinutes: summary.totalDurationMinutes,
      totalFuelCost: summary.totalFuelCost,
      isRoundTrip,
      waypointCount,
      costPerPerson: summary.costPerPerson,
      drivingDays: summary.drivingDays,
    };

    // Keep last 5
    const updated = [snapshot, ...history].slice(0, 5);
    try {
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save trip history', e);
    }
    return updated;
};

// --- Last Used Origin ---
// Persists the user's most recent trip origin so it can be pre-filled on return visits.

export const saveLastOrigin = (location: Location): void => {
  try {
    localStorage.setItem(KEYS.LAST_ORIGIN, JSON.stringify(location));
  } catch (e) {
    console.warn('Failed to save last origin', e);
  }
};

export const getLastOrigin = (): Location | null => {
  try {
    const data = localStorage.getItem(KEYS.LAST_ORIGIN);
    if (!data) return null;
    const loc = JSON.parse(data) as Location;
    // Sanity-check: must have valid coords and a name
    if (!loc.lat || !loc.lng || loc.lat === 0 || !loc.name) return null;
    return loc;
  } catch {
    return null;
  }
};

// --- Settings Defaults (user preference persistence) ---
// Only persists preference-level fields — NOT trip-specific dates or budget totals.

const SETTINGS_DEFAULTS_KEYS: (keyof TripSettings)[] = [
  'units', 'currency', 'maxDriveHours', 'numTravelers', 'numDrivers', 'driverNames',
  'gasPrice', 'hotelPricePerNight', 'mealPricePerDay',
  'budgetMode', 'routePreference', 'stopFrequency',
  'includeStartingLocation',
];

export const saveSettingsDefaults = (settings: TripSettings): void => {
  const toSave: Partial<TripSettings> = {};
  for (const key of SETTINGS_DEFAULTS_KEYS) {
    (toSave as Record<string, unknown>)[key] = settings[key];
  }
  try {
    localStorage.setItem(KEYS.DEFAULT_SETTINGS, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to save settings defaults', e);
  }
};

export const loadSettingsDefaults = (): Partial<TripSettings> => {
  try {
    const data = localStorage.getItem(KEYS.DEFAULT_SETTINGS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

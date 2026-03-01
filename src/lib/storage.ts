import type { Location, TripSummary, TripSettings } from '../types';

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
  getDefaultBudgetProfile,
  updateBudgetProfileStats,
  suggestBudgetProfile,
  getLastTripBudget,
  saveLastTripBudget,
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
  const exists = favorites.find(f => f.name === location.name); // Simple dup check by name for now
  
  if (exists) {
    favorites = favorites.filter(f => f.name !== location.name);
  } else {
    favorites.push({ ...location, isFavorite: true });
  }
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  return favorites;
};

// --- History (Trips) ---
// We'll store a simplified summary to avoid hitting storage limits
export const getHistory = (): TripSummary[] => {
    try {
        const data = localStorage.getItem(KEYS.HISTORY);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
};

export const addToHistory = (summary: TripSummary) => {
    const history = getHistory();
    // Add new trip to start
    const newEntry = {
        ...summary,
        // Add a timestamp or ID if needed, but summary usually has data
        displayDate: new Date().toISOString()
    };

    // Keep last 5
    const updated = [newEntry, ...history].slice(0, 5);
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
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
  'units', 'currency', 'maxDriveHours', 'numTravelers', 'numDrivers',
  'gasPrice', 'hotelPricePerNight', 'mealPricePerDay',
  'budgetMode', 'routePreference', 'stopFrequency',
  'beastMode', 'includeStartingLocation',
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

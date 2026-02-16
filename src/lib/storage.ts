import type { Vehicle, Location, TripSummary, SavedBudgetProfile, LastTripBudget, TripBudget } from '../types';

const STORAGE_VERSION = 1;

const KEYS = {
  GARAGE: 'roadtrip_garage',
  FAVORITES: 'roadtrip_favorites',
  HISTORY: 'roadtrip_history',
  SETTINGS: 'roadtrip_settings',
  DEFAULT_VEHICLE: 'roadtrip_default_vehicle_id',
  BUDGET_PROFILES: 'roadtrip_budget_profiles',
  DEFAULT_BUDGET_PROFILE: 'roadtrip_default_budget_id',
  LAST_TRIP_BUDGET: 'roadtrip_last_trip_budget',
  VERSION: 'roadtrip_storage_version',
};

export interface SavedVehicle extends Vehicle {
  id: string;
  name: string;
  lastUsed?: string; // ISO timestamp
  isDefault?: boolean;
}

// Version migration helper
const checkStorageVersion = () => {
  const currentVersion = localStorage.getItem(KEYS.VERSION);
  if (!currentVersion || parseInt(currentVersion) < STORAGE_VERSION) {
    // Future: Add migration logic here if data structure changes
    localStorage.setItem(KEYS.VERSION, STORAGE_VERSION.toString());
  }
};

export interface SavedLocation extends Location {
  isFavorite?: boolean;
}

// --- Garage (Vehicles) ---

export const getGarage = (): SavedVehicle[] => {
  checkStorageVersion();
  try {
    const data = localStorage.getItem(KEYS.GARAGE);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load garage", e);
    return [];
  }
};

export const saveToGarage = (vehicle: SavedVehicle) => {
  const garage = getGarage();
  const updatedVehicle = {
    ...vehicle,
    lastUsed: new Date().toISOString()
  };
  const index = garage.findIndex(v => v.id === vehicle.id);
  if (index >= 0) {
    garage[index] = updatedVehicle;
  } else {
    garage.push(updatedVehicle);
  }
  localStorage.setItem(KEYS.GARAGE, JSON.stringify(garage));
  return garage;
};

export const removeFromGarage = (id: string) => {
  const garage = getGarage().filter(v => v.id !== id);
  localStorage.setItem(KEYS.GARAGE, JSON.stringify(garage));
  return garage;
};

export const getDefaultVehicleId = (): string | null => {
  return localStorage.getItem(KEYS.DEFAULT_VEHICLE);
};

export const setDefaultVehicleId = (id: string) => {
  // Update garage to mark this vehicle as default
  const garage = getGarage();
  const updated = garage.map(v => ({
    ...v,
    isDefault: v.id === id
  }));
  localStorage.setItem(KEYS.GARAGE, JSON.stringify(updated));
  localStorage.setItem(KEYS.DEFAULT_VEHICLE, id);
};

export const getDefaultVehicle = (): SavedVehicle | null => {
  const garage = getGarage();
  const defaultId = getDefaultVehicleId();

  if (defaultId) {
    const vehicle = garage.find(v => v.id === defaultId);
    if (vehicle) return vehicle;
  }

  // Fallback to most recently used
  if (garage.length > 0) {
    const sorted = [...garage].sort((a, b) => {
      const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return bTime - aTime;
    });
    return sorted[0];
  }

  return null;
};

// --- Favorites (Locations) ---

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

// --- Budget Profiles ---

export const getBudgetProfiles = (): SavedBudgetProfile[] => {
  checkStorageVersion();
  try {
    const data = localStorage.getItem(KEYS.BUDGET_PROFILES);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load budget profiles", e);
    return [];
  }
};

export const saveBudgetProfile = (profile: SavedBudgetProfile): SavedBudgetProfile[] => {
  const profiles = getBudgetProfiles();
  const updated: SavedBudgetProfile = {
    ...profile,
    lastUsed: new Date().toISOString(),
    stats: {
      ...profile.stats,
      timesUsed: (profile.stats?.timesUsed || 0) + (profiles.find(p => p.id === profile.id) ? 0 : 1),
    },
  };

  const index = profiles.findIndex(p => p.id === profile.id);
  if (index >= 0) {
    profiles[index] = updated;
  } else {
    profiles.push(updated);
  }

  localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));
  return profiles;
};

export const removeBudgetProfile = (id: string): SavedBudgetProfile[] => {
  const profiles = getBudgetProfiles().filter(p => p.id !== id);
  localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));

  // Clear default if we removed it
  if (localStorage.getItem(KEYS.DEFAULT_BUDGET_PROFILE) === id) {
    localStorage.removeItem(KEYS.DEFAULT_BUDGET_PROFILE);
  }

  return profiles;
};

export const setDefaultBudgetProfile = (id: string): void => {
  const profiles = getBudgetProfiles().map(p => ({
    ...p,
    isDefault: p.id === id,
  }));
  localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));
  localStorage.setItem(KEYS.DEFAULT_BUDGET_PROFILE, id);
};

export const getDefaultBudgetProfile = (): SavedBudgetProfile | null => {
  const profiles = getBudgetProfiles();
  const defaultId = localStorage.getItem(KEYS.DEFAULT_BUDGET_PROFILE);

  if (defaultId) {
    const profile = profiles.find(p => p.id === defaultId);
    if (profile) return profile;
  }

  // Fallback to most recently used
  if (profiles.length > 0) {
    const sorted = [...profiles].sort((a, b) => {
      const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return bTime - aTime;
    });
    return sorted[0];
  }

  return null;
};

// Update profile stats after a trip is completed
export const updateBudgetProfileStats = (id: string, tripName: string): void => {
  const profiles = getBudgetProfiles();
  const index = profiles.findIndex(p => p.id === id);

  if (index >= 0) {
    profiles[index] = {
      ...profiles[index],
      lastUsed: new Date().toISOString(),
      stats: {
        timesUsed: (profiles[index].stats?.timesUsed || 0) + 1,
        lastTripName: tripName,
        lastTripDate: new Date().toISOString(),
      },
    };
    localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));
  }
};

// Smart suggestion: find profile that matches traveler count or trip type
export const suggestBudgetProfile = (numTravelers?: number): SavedBudgetProfile | null => {
  const profiles = getBudgetProfiles();

  // First, try to match by traveler count
  if (numTravelers) {
    const match = profiles.find(p => p.numTravelers === numTravelers);
    if (match) return match;
  }

  // Fallback to default or most recent
  return getDefaultBudgetProfile();
};

// --- Last Trip Budget Recall ---

export const getLastTripBudget = (): LastTripBudget | null => {
  try {
    const data = localStorage.getItem(KEYS.LAST_TRIP_BUDGET);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveLastTripBudget = (
  tripName: string,
  budget: TripBudget,
  numTravelers: number
): void => {
  const lastTrip: LastTripBudget = {
    tripName,
    tripDate: new Date().toISOString(),
    budget,
    numTravelers,
  };
  localStorage.setItem(KEYS.LAST_TRIP_BUDGET, JSON.stringify(lastTrip));
};

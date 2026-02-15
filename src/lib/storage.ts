import type { Vehicle, Location, TripSummary } from '../types';

const STORAGE_VERSION = 1;

const KEYS = {
  GARAGE: 'roadtrip_garage',
  FAVORITES: 'roadtrip_favorites',
  HISTORY: 'roadtrip_history',
  SETTINGS: 'roadtrip_settings',
  DEFAULT_VEHICLE: 'roadtrip_default_vehicle_id',
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

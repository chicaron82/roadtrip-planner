/**
 * storage-budget.ts — Budget profile + last-trip persistence
 *
 * Handles saved budget profiles, default-profile tracking, per-profile stats,
 * and the "last trip budget" recall feature.
 */

import type { SavedBudgetProfile, LastTripBudget, TripBudget } from '../types';

const STORAGE_VERSION = 1;

const KEYS = {
  BUDGET_PROFILES: 'roadtrip_budget_profiles',
  DEFAULT_BUDGET_PROFILE: 'roadtrip_default_budget_id',
  LAST_TRIP_BUDGET: 'roadtrip_last_trip_budget',
  VERSION: 'roadtrip_storage_version',
};

const checkStorageVersion = () => {
  const currentVersion = localStorage.getItem(KEYS.VERSION);
  if (!currentVersion || parseInt(currentVersion) < STORAGE_VERSION) {
    localStorage.setItem(KEYS.VERSION, STORAGE_VERSION.toString());
  }
};

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

/** Update profile stats after a trip is completed. */
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

/** Smart suggestion: find profile matching traveler count, else return default. */
export const suggestBudgetProfile = (numTravelers?: number): SavedBudgetProfile | null => {
  const profiles = getBudgetProfiles();

  if (numTravelers) {
    const match = profiles.find(p => p.numTravelers === numTravelers);
    if (match) return match;
  }

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

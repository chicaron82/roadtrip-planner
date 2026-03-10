/**
 * storage-budget.ts — Budget profile + last-trip persistence
 *
 * Handles saved budget profiles, default-profile tracking, per-profile stats,
 * and the "last trip budget" recall feature.
 */

import type { SavedBudgetProfile, LastTripBudget } from '../types';

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
    try {
      localStorage.setItem(KEYS.VERSION, STORAGE_VERSION.toString());
    } catch { /* private browsing — ignore */ }
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

  try {
    localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));
  } catch (e) {
    console.warn('Failed to save budget profile', e);
  }
  return profiles;
};

export const removeBudgetProfile = (id: string): SavedBudgetProfile[] => {
  const profiles = getBudgetProfiles().filter(p => p.id !== id);
  try {
    localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));
  } catch (e) {
    console.warn('Failed to remove budget profile', e);
  }

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
  try {
    localStorage.setItem(KEYS.BUDGET_PROFILES, JSON.stringify(profiles));
    localStorage.setItem(KEYS.DEFAULT_BUDGET_PROFILE, id);
  } catch (e) {
    console.warn('Failed to save default budget profile', e);
  }
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



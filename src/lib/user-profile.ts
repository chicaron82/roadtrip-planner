import type { BudgetProfile, TripSettings } from '../types';

// Rolling trip history limit — keeps storage lean
const MAX_TRIP_HISTORY = 10;
// Recency decay constant — trips ~12 months old carry ~17% weight
const DECAY_LAMBDA = 0.15;
// Minimum trips before we surface the adaptive label
export const ADAPTIVE_CONFIDENCE_THRESHOLD = 3;
// Schema version for future migrations
const PROFILE_VERSION = 1;

// Chicharon's baseline — the anchor. Always available as "Reset" target.
export const CHICHARON_BASELINE = {
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
} as const;

export interface TripRecord {
  date: number;                // Unix timestamp (ms)
  tripLengthDays: number;      // departure → return in days (0 = same day)
  budgetProfile: BudgetProfile;
  hotelPricePerNight: number;
  mealPricePerDay: number;
  numTravelers: number;
  hadGasBuffer: boolean;       // false = user removed the gas lever entirely
}

export interface UserProfile {
  version: number;
  trips: TripRecord[];
}

export interface AdaptiveDefaults {
  hotelPricePerNight: number;
  mealPricePerDay: number;
  tripCount: number;           // trips that contributed to this average
}

// --- Recency Weighting ---
// w = e^(-λ * Δt_months)
const recencyWeight = (timestampMs: number): number => {
  const now = Date.now();
  const monthsAgo = (now - timestampMs) / (1000 * 60 * 60 * 24 * 30);
  return Math.exp(-DECAY_LAMBDA * monthsAgo);
};

// --- Helpers ---

const tripLengthFromDates = (departure: string, returnDate: string): number => {
  if (!departure || !returnDate) return 0;
  try {
    const dep = new Date(departure).getTime();
    const ret = new Date(returnDate).getTime();
    return Math.max(0, Math.round((ret - dep) / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

const weightedAvg = (pairs: [number, number][]): number => {
  const totalWeight = pairs.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight === 0) return 0;
  return pairs.reduce((sum, [v, w]) => sum + v * w, 0) / totalWeight;
};

// --- Profile Storage ---

const STORAGE_KEY = 'roadtrip_user_profile';
let profileCache: UserProfile | null = null;

export const getUserProfile = (): UserProfile => {
  if (profileCache) return profileCache;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as UserProfile;
      if (parsed.version === PROFILE_VERSION && Array.isArray(parsed.trips)) {
        profileCache = parsed;
        return parsed;
      }
    }
  } catch {
    // Corrupted storage — start fresh
  }
  const fresh: UserProfile = { version: PROFILE_VERSION, trips: [] };
  profileCache = fresh;
  return fresh;
};

const saveUserProfile = (profile: UserProfile): void => {
  profileCache = profile;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save user profile', e);
  }
};

// Exposed for testing only
export const _clearProfileCache = (): void => {
  profileCache = null;
};

// --- Record a Trip ---
// Called when user commits to a calculated route (step 2 → step 3).

export const recordTrip = (settings: TripSettings): void => {
  const profile = getUserProfile();

  const record: TripRecord = {
    date: Date.now(),
    tripLengthDays: tripLengthFromDates(settings.departureDate, settings.returnDate),
    budgetProfile: settings.budget.profile,
    hotelPricePerNight: settings.hotelPricePerNight,
    mealPricePerDay: settings.mealPricePerDay,
    numTravelers: settings.numTravelers,
    hadGasBuffer: settings.budget.weights.gas > 0,
  };

  const updated: UserProfile = {
    ...profile,
    trips: [...profile.trips, record].slice(-MAX_TRIP_HISTORY),
  };

  saveUserProfile(updated);
};

// --- Compute Adaptive Defaults ---
// Returns null if we don't yet have enough trips to be confident.

export const getAdaptiveDefaults = (profile?: UserProfile): AdaptiveDefaults | null => {
  const p = profile ?? getUserProfile();
  if (p.trips.length < ADAPTIVE_CONFIDENCE_THRESHOLD) return null;

  const weighted = p.trips.map(t => ({
    ...t,
    w: recencyWeight(t.date),
  }));

  const hotelPricePerNight = Math.round(
    weightedAvg(weighted.map(t => [t.hotelPricePerNight, t.w]))
  );
  const mealPricePerDay = Math.round(
    weightedAvg(weighted.map(t => [t.mealPricePerDay, t.w]))
  );

  return {
    hotelPricePerNight,
    mealPricePerDay,
    tripCount: p.trips.length,
  };
};

// --- Export as Shareable Preset ---
// Wraps the user's adaptive defaults into a StylePreset they can name and share.
import type { StylePreset } from './style-presets';

export const exportAsPreset = (name: string): StylePreset | null => {
  const defaults = getAdaptiveDefaults();
  if (!defaults) return null;
  return {
    id: `user-${Date.now()}`,
    name,
    creatorName: name,
    hotelPricePerNight: defaults.hotelPricePerNight,
    mealPricePerDay: defaults.mealPricePerDay,
    description: `Based on ${defaults.tripCount} trip${defaults.tripCount !== 1 ? 's' : ''}.`,
  };
};

// True if adaptive values differ meaningfully from Chicharon's baseline (>10% on either field).
// Used to decide whether to surface the adaptive banner.
export const isAdaptiveMeaningful = (defaults: AdaptiveDefaults): boolean => {
  const hotelDelta =
    Math.abs(defaults.hotelPricePerNight - CHICHARON_BASELINE.hotelPricePerNight) /
    CHICHARON_BASELINE.hotelPricePerNight;
  const mealDelta =
    Math.abs(defaults.mealPricePerDay - CHICHARON_BASELINE.mealPricePerDay) /
    CHICHARON_BASELINE.mealPricePerDay;
  return hotelDelta > 0.1 || mealDelta > 0.1;
};

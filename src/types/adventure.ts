// ==================== ADVENTURE MODE ====================

import type { Location, TripPreference } from './core';

// Adventure Mode input configuration
export interface AdventureConfig {
  origin: Location;
  budget: number;
  days: number;
  travelers: number;
  preferences: TripPreference[];
  // Optional constraints
  maxDriveHoursPerDay?: number;
  accommodationType?: 'budget' | 'moderate' | 'comfort';
  isRoundTrip?: boolean; // Default true - set false for one-way adventures
  /** Fuel cost per km derived from user's actual vehicle + gas price.
   *  When provided overrides the hardcoded $0.12/km COST_ESTIMATES fallback. */
  fuelCostPerKm?: number;
  /** Rooms to book per night. Defaults to 1. Users can override (e.g. 2 rooms for privacy). */
  numRooms?: number;
}

// A reachable destination suggestion
export interface AdventureDestination {
  id: string;
  location: Location;
  name: string;
  description?: string;
  category: 'city' | 'nature' | 'beach' | 'mountain' | 'historic';

  // Distance & cost estimates
  distanceKm: number;
  estimatedDriveHours: number;

  // Budget breakdown
  estimatedCosts: {
    fuel: number;
    accommodation: number;
    food: number;
    total: number;
    remaining: number; // Budget - total = spending money
  };

  // Budget fit
  /** True when estimated costs exceed the budget (shown with a "tight budget" warning). */
  isOverBudget: boolean;

  // Ranking
  score: number; // 0-100 composite score
  matchReasons: string[]; // Why this is a good match

  // Visual
  imageUrl?: string;
  tags: string[];
}

// Adventure Mode result
export interface AdventureResult {
  config: AdventureConfig;
  maxReachableKm: number; // Furthest you can go and return
  destinations: AdventureDestination[];
  calculatedAt: Date;
}

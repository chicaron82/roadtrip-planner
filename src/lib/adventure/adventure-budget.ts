import type { BudgetProfile, TripPreference } from '../../types';

/**
 * Build budget allocations from an adventure mode selection.
 *
 * Pure function — maps preferences + accommodation type to a budget profile
 * and distributes the total budget across gas/hotel/food/misc categories.
 *
 * Extracted from App.tsx handleAdventureSelect to keep App slim.
 */

const PREFERENCE_TO_PROFILE: Record<string, BudgetProfile> = {
  foodie: 'foodie',
  scenic: 'scenic',
  budget: 'balanced',
  family: 'balanced',
};

const DISCRETIONARY_WEIGHTS: Record<BudgetProfile, { hotel: number; food: number; misc: number }> = {
  balanced: { hotel: 45, food: 40, misc: 15 },
  foodie:   { hotel: 25, food: 60, misc: 15 },
  scenic:   { hotel: 50, food: 30, misc: 20 },
  custom:   { hotel: 45, food: 40, misc: 15 },
};

export interface AdventureBudgetResult {
  profile: BudgetProfile;
  gas: number;
  hotel: number;
  food: number;
  misc: number;
  total: number;
  weights: { gas: number; hotel: number; food: number; misc: number };
}

export function buildAdventureBudget(
  totalBudget: number,
  estimatedDistanceKm: number,
  preferences: TripPreference[],
  accommodationType: 'budget' | 'moderate' | 'comfort',
): AdventureBudgetResult {
  // Determine profile from preferences, fall back to accommodation type
  let profile: BudgetProfile = 'balanced';
  if (preferences.length > 0) {
    profile = PREFERENCE_TO_PROFILE[preferences[0]] || 'balanced';
  } else if (accommodationType === 'budget' || accommodationType === 'comfort') {
    profile = 'balanced';
  }

  const estimatedGasCost = Math.round(estimatedDistanceKm * 0.12);
  const remainingBudget = totalBudget - estimatedGasCost;

  const discWeights = DISCRETIONARY_WEIGHTS[profile];
  const hotel = Math.round(remainingBudget * (discWeights.hotel / 100));
  const food = Math.round(remainingBudget * (discWeights.food / 100));
  const misc = Math.round(remainingBudget * (discWeights.misc / 100));

  return {
    profile,
    gas: estimatedGasCost,
    hotel,
    food,
    misc,
    total: totalBudget,
    weights: {
      gas: Math.round((estimatedGasCost / totalBudget) * 100),
      hotel: Math.round((hotel / totalBudget) * 100),
      food: Math.round((food / totalBudget) * 100),
      misc: Math.round((misc / totalBudget) * 100),
    },
  };
}

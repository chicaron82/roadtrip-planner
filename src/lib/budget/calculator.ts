import type { TripBudget, TripSettings, BudgetWeights } from '../../types';
import { COST_ESTIMATES, BUDGET_PROFILES } from './defaults';

/**
 * Apply weight profile to a total budget amount.
 * Returns category amounts based on percentage weights.
 */
export function applyBudgetWeights(total: number, weights: BudgetWeights): Pick<TripBudget, 'gas' | 'hotel' | 'food' | 'misc'> {
  const gas = Math.round(total * (weights.gas / 100));
  const hotel = Math.round(total * (weights.hotel / 100));
  const food = Math.round(total * (weights.food / 100));
  const misc = total - gas - hotel - food; // Absorb rounding remainder
  return { gas, hotel, food, misc };
}

/**
 * Calculate per-person cost.
 */
export function getPerPersonCost(total: number, numTravelers: number): number {
  return numTravelers > 0 ? Math.round(total / numTravelers) : 0;
}

/**
 * Create a budget with smart defaults based on trip parameters.
 */
export function createSmartBudget(
  totalDays: number,
  totalDistanceKm: number,
  numTravelers: number,
  settings: TripSettings,
  plannedNights?: number, // explicit overnight stops; defaults to totalDays - 1 if omitted
): TripBudget {
  const nights = plannedNights !== undefined
    ? plannedNights
    : Math.max(0, totalDays - 1);
  const roomsNeeded = Math.ceil(numTravelers / 2);

  // Estimate costs
  const gasEstimate = totalDistanceKm * COST_ESTIMATES.gasPerKm;
  const hotelEstimate = nights * roomsNeeded * settings.hotelPricePerNight;
  const foodEstimate = totalDays * numTravelers * settings.mealPricePerDay;
  const total = Math.round(gasEstimate + hotelEstimate + foodEstimate);

  // Calculate actual weights based on estimates (misc absorbs rounding remainder)
  let weights: BudgetWeights;
  if (total > 0) {
    const gasW = Math.round((gasEstimate / total) * 100);
    const hotelW = Math.round((hotelEstimate / total) * 100);
    const foodW = Math.round((foodEstimate / total) * 100);
    weights = { gas: gasW, hotel: hotelW, food: foodW, misc: 100 - gasW - hotelW - foodW };
  } else {
    weights = BUDGET_PROFILES.balanced.weights;
  }

  return {
    mode: 'open',
    allocation: 'flexible',
    profile: 'balanced',
    weights,
    gas: Math.round(gasEstimate),
    hotel: Math.round(hotelEstimate),
    food: Math.round(foodEstimate),
    misc: 0,
    total,
  };
}

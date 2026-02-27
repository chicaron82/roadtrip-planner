import type { TripDay, TripBudget, CostBreakdown } from '../../types';
import { ceilToNearest } from './day-builder';

/**
 * Calculate overall cost breakdown for the trip.
 */
export function calculateCostBreakdown(
  days: TripDay[],
  numTravelers: number,
): CostBreakdown {
  const fuel = days.reduce((sum, d) => sum + d.budget.gasUsed, 0);
  const accommodation = days.reduce((sum, d) => sum + d.budget.hotelCost, 0);
  const meals = days.reduce((sum, d) => sum + d.budget.foodEstimate, 0);
  const misc = days.reduce((sum, d) => sum + d.budget.miscCost, 0);
  const total = fuel + accommodation + meals + misc;

  const roundedFuel = ceilToNearest(fuel, 5);
  const roundedAccommodation = ceilToNearest(accommodation, 5);
  const roundedMeals = ceilToNearest(meals, 5);
  const roundedMisc = ceilToNearest(misc, 5);
  const roundedTotal = ceilToNearest(roundedFuel + roundedAccommodation + roundedMeals + roundedMisc, 10);

  return {
    fuel: roundedFuel,
    accommodation: roundedAccommodation,
    meals: roundedMeals,
    misc: roundedMisc,
    total: roundedTotal,
    perPerson: numTravelers > 0 ? ceilToNearest(roundedTotal / numTravelers, 5) : roundedTotal,
  };
}

/**
 * Determine budget status based on planned vs actual.
 */
export function getBudgetStatus(
  budget: TripBudget,
  costBreakdown: CostBreakdown,
): 'under' | 'at' | 'over' {
  if (budget.mode === 'open' || budget.total === 0) return 'under';

  const diff = budget.total - costBreakdown.total;
  if (diff > budget.total * 0.1) return 'under'; // More than 10% under
  if (diff < 0) return 'over';
  return 'at';
}

/**
 * Format budget remaining with status indicator.
 */
export function formatBudgetRemaining(remaining: number): {
  text: string;
  status: 'good' | 'warning' | 'over';
} {
  if (remaining > 0) {
    return { text: `$${remaining.toFixed(0)} remaining`, status: 'good' };
  } else if (remaining === 0) {
    return { text: 'Budget reached', status: 'warning' };
  } else {
    return { text: `$${Math.abs(remaining).toFixed(0)} over`, status: 'over' };
  }
}

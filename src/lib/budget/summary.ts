import type { TripDay, TripBudget, CostBreakdown } from '../../types';

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

  return {
    fuel: Math.round(fuel * 100) / 100,
    accommodation: Math.round(accommodation * 100) / 100,
    meals: Math.round(meals * 100) / 100,
    misc: Math.round(misc * 100) / 100,
    total: Math.round(total * 100) / 100,
    perPerson: numTravelers > 0 ? Math.round((total / numTravelers) * 100) / 100 : Math.round(total * 100) / 100,
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

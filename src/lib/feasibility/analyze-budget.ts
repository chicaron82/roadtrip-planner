import type { TripSummary, TripSettings } from '../../types';
import type { FeasibilityWarning } from './types';
import { TRIP_CONSTANTS } from '../trip-constants';

export function analyzeBudget(
  summary: TripSummary,
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const budget = settings.budget;
  const days = summary.days || [];

  if (budget.total <= 0) return warnings;

  // Read the bank balance from the last day — it reflects all spend.
  const lastDay = days[days.length - 1];
  const bankRemaining = lastDay?.budget.bankRemaining ?? budget.total;
  const totalUsed = budget.total - bankRemaining;
  const utilization = totalUsed / budget.total;

  // Open mode: informational hint only if clearly over reference budget.
  if (settings.budgetMode !== 'plan-to-budget') {
    if (utilization > TRIP_CONSTANTS.budget.overThreshold) {
      warnings.push({
        category: 'budget',
        severity: 'info',
        message: 'Tracking above base budget estimates',
        detail: `Expected cost is $${Math.round(totalUsed)} vs reference budget of $${Math.round(budget.total)}.`,
        suggestion: 'Consider budgeting a little more for this trip.',
      });
    }
    return warnings;
  }

  // Plan-to-budget mode: check the bank.
  if (bankRemaining < 0) {
    const shortBy = Math.round(Math.abs(bankRemaining));
    // Find the biggest spend category to give a targeted suggestion.
    const hotelTotal = days.reduce((sum, d) => sum + d.budget.hotelCost, 0);
    const foodTotal  = days.reduce((sum, d) => sum + d.budget.foodEstimate, 0);
    const gasTotal   = days.reduce((sum, d) => sum + d.budget.gasUsed, 0);
    let suggestion: string;
    if (hotelTotal >= gasTotal && hotelTotal >= foodTotal) {
      suggestion = `Hotels are your biggest expense (~$${Math.round(hotelTotal)}). Shopping for better rates or sharing rooms could close the gap.`;
    } else if (foodTotal >= gasTotal) {
      suggestion = `Meals are your biggest variable (~$${Math.round(foodTotal)}). Cooking in or picking cheaper stops could help.`;
    } else {
      suggestion = `Fuel is your biggest variable (~$${Math.round(gasTotal)}). A more fuel-efficient vehicle or fewer driving days could help.`;
    }
    warnings.push({
      category: 'budget',
      severity: 'warning',
      message: `Trip may run ~$${shortBy} over estimate`,
      detail: `Estimated total: $${Math.round(totalUsed)}. Budget: $${Math.round(budget.total)}. These are estimates — your actual costs may differ.`,
      suggestion,
    });
  } else if (utilization >= TRIP_CONSTANTS.budget.tightThreshold) {
    warnings.push({
      category: 'budget',
      severity: 'warning',
      message: `Budget is tight — $${Math.round(bankRemaining)} remaining`,
      detail: `Using ${Math.round(utilization * 100)}% of your $${Math.round(budget.total)} budget.`,
      suggestion: 'Leave some buffer for unexpected expenses like parking, activities, or a nice detour.',
    });
  }

  return warnings;
}

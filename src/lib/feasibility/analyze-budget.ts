import type { TripSummary, TripSettings } from '../../types';
import type { FeasibilityWarning } from './types';
import { calculateTotalBudgetUsed } from './helpers';
import { TRIP_CONSTANTS } from '../trip-constants';

export function analyzeBudget(
  summary: TripSummary,
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const budget = settings.budget;

  // Calculate totals before bailout so we can hint in open mode
  const days = summary.days || [];
  const totalUsed = calculateTotalBudgetUsed(days);
  const utilization = budget.total > 0 ? totalUsed / budget.total : 0;

  if (settings.budgetMode !== 'plan-to-budget' || budget.total <= 0) {
    if (budget.total > 0 && utilization > TRIP_CONSTANTS.budget.overThreshold) {
      warnings.push({
        category: 'budget',
        severity: 'info',
        message: 'Tracking above base budget estimates',
        detail: `Expected cost is $${Math.round(totalUsed)} vs reference budget of $${Math.round(budget.total)}.`,
        suggestion: 'Consider budgeting a little more for this trip.',
      });
    }
    return warnings; // No strict budget constraints in open mode
  }

  if (utilization > TRIP_CONSTANTS.budget.overThreshold) {
    const overBy = Math.round(totalUsed - budget.total);
    warnings.push({
      category: 'budget',
      severity: 'warning', // Downgraded from critical to avoid "Not Feasible"
      message: `Over budget by $${overBy}`,
      detail: `Total estimated cost: $${Math.round(totalUsed)}. Budget: $${Math.round(budget.total)}.`,
      suggestion: 'Consider reducing hotel costs, cutting a stop, reducing trip days, or increasing the budget.',
    });
  } else if (utilization >= TRIP_CONSTANTS.budget.tightThreshold) {
    const remaining = Math.round(budget.total - totalUsed);
    warnings.push({
      category: 'budget',
      severity: 'warning',
      message: `Budget is tight — $${remaining} remaining`,
      detail: `Using ${Math.round(utilization * 100)}% of your $${Math.round(budget.total)} budget.`,
      suggestion: 'Leave some buffer for unexpected expenses.',
    });
  }

  // Per-category analysis
  if (budget.gas > 0) {
    const gasUsed = days.reduce((sum, d) => sum + d.budget.gasUsed, 0);
    if (gasUsed > budget.gas) {
      warnings.push({
        category: 'budget',
        severity: 'warning',
        message: `Gas budget exceeded by $${Math.round(gasUsed - budget.gas)}`,
        detail: `Gas estimate: $${Math.round(gasUsed)}. Gas budget: $${Math.round(budget.gas)}.`,
      });
    }
  }

  if (budget.hotel > 0) {
    const hotelUsed = days.reduce((sum, d) => sum + d.budget.hotelCost, 0);
    if (hotelUsed > budget.hotel) {
      warnings.push({
        category: 'budget',
        severity: 'warning',
        message: `Hotel budget exceeded by $${Math.round(hotelUsed - budget.hotel)}`,
        detail: `Hotel estimate: $${Math.round(hotelUsed)}. Hotel budget: $${Math.round(budget.hotel)}.`,
      });
    }
  }

  return warnings;
}

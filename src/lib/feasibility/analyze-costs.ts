import type { TripSummary, TripSettings } from '../../types';
import type { FeasibilityWarning } from './types';
import { calculateTotalBudgetUsed } from './helpers';

export function analyzePerPersonCosts(
  summary: TripSummary,
  settings: TripSettings,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const days = summary.days || [];

  if (settings.numTravelers <= 0) return warnings;

  const totalCost = calculateTotalBudgetUsed(days);
  const perPerson = Math.round(totalCost / settings.numTravelers);
  const budget = settings.budget;

  // Inform about per-person cost when in budget mode
  if (budget.mode === 'plan-to-budget' && budget.total > 0) {
    const perPersonBudget = Math.round(budget.total / settings.numTravelers);
    if (perPerson > perPersonBudget) {
      warnings.push({
        category: 'passenger',
        severity: 'warning',
        message: `Per-person cost ($${perPerson}) exceeds per-person budget ($${perPersonBudget})`,
        detail: `${settings.numTravelers} traveler${settings.numTravelers > 1 ? 's' : ''} splitting $${Math.round(totalCost)} total.`,
      });
    }
  }

  return warnings;
}

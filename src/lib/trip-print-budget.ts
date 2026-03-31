import type { TripDay } from '../types';
import { formatCurrency } from './trip-print-formatters';

// ── Budget row HTML builder ──────────────────────────────────────────────────

export function buildBudgetHTML(day: TripDay, tripBudgetRemaining?: number): string {
  const budget = day.budget;

  // Only show budget tracking when the user actually set a budget.
  // tripBudgetRemaining is undefined in open mode — don't compare against $0.
  const tripBudgetHTML = tripBudgetRemaining === undefined
    ? ''  // open mode — no tracker, no "over by" nonsense
    : tripBudgetRemaining < 0
      ? `&nbsp;|&nbsp; ⚠️ Trip budget over by: ${formatCurrency(Math.abs(tripBudgetRemaining))}`
      : `&nbsp;|&nbsp; ${formatCurrency(tripBudgetRemaining)} remaining`;

  return `
    <div class="budget-row">
      💰 <strong>Day Estimate:</strong>
      ⛽ ${formatCurrency(budget.gasUsed)} fuel est.
      • 🏨 ${formatCurrency(budget.hotelCost)} hotel est.
      • 🍽️ ${formatCurrency(budget.foodEstimate)} meals est.
      • Est. total: <strong>${formatCurrency(budget.dayTotal)}</strong>
      ${tripBudgetHTML}
    </div>
  `;
}

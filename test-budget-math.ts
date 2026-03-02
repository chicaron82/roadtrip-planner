import { calculateCostBreakdown, getBudgetStatus } from './src/lib/budget/summary';

// Let's reverse engineer the screenshot's math
// TRIP BUDGET BREAKDOWN $3,270.00
// Fuel $420.00
// Hotel $1,800.00
// Meals $1,050.00

// UNDER BUDGET $270.00
// $1,090/person * 3 travelers = $3,270.00

const costBreakdown = {
  fuel: 420.00,
  accommodation: 1800.00,
  meals: 1050.00,
  misc: 0,
  total: 3270.00,
  perPerson: 1090.00
};

// If TripSummaryCard shows UNDER BUDGET, then budgetStatus must be 'under'
// It calculates remaining as `settings.budget.total` - `summary.costBreakdown.total`.
// The UI shows absolute of $270.00.
// This means the equation is either:
// A: 3000 - 3270 = -270 (but then status MUST be 'under' despite negative diff for it to say "UNDER BUDGET")
// B: 3540 - 3270 = 270 (then status is genuinely 'under', and user budgeted 3540)

let budgetA = { mode: 'plan-to-budget' as any, total: 3000, gas: 0, hotel: 0, food: 0, weights: { gas: 0, hotel: 0, food: 0 }};
console.log('Status A (Budget 3000):', getBudgetStatus(budgetA, costBreakdown));

let budgetB = { mode: 'plan-to-budget' as any, total: 3540, gas: 0, hotel: 0, food: 0, weights: { gas: 0, hotel: 0, food: 0 }};
console.log('Status B (Budget 3540):', getBudgetStatus(budgetB, costBreakdown));

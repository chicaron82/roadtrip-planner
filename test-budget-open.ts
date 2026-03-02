import { getBudgetStatus } from './src/lib/budget/summary';

const budget = {
  mode: 'open' as const,
  total: 3000,
  gas: 0,
  hotel: 0,
  food: 0,
  misc: 0,
  allocation: 'fixed' as const,
  profile: 'balanced' as const,
  weights: { gas: 0, hotel: 0, food: 0, misc: 0 }
};

const costBreakdown = {
  fuel: 420,
  accommodation: 1800,
  meals: 1050,
  misc: 0,
  total: 3270,
  perPerson: 1090
};

const status = getBudgetStatus(budget, costBreakdown);
const remaining = budget.total - costBreakdown.total;

console.log(`Mode: open`);
console.log(`Total: ${budget.total}, Cost: ${costBreakdown.total}`);
console.log(`Status: ${status}`);
console.log(`Remaining: ${remaining} -> UI displays: Math.abs(${remaining}) = ${Math.abs(remaining)}`);

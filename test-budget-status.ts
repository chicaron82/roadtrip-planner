import { getBudgetStatus, calculateCostBreakdown } from './src/lib/budget/summary';

// Simulate the days from the screenshot
const days = [
  { budget: { gasUsed: 104.5, hotelCost: 300, foodEstimate: 150, miscCost: 0, dayTotal: 560 } },
  { budget: { gasUsed: 104.5, hotelCost: 300, foodEstimate: 150, miscCost: 0, dayTotal: 560 } },
  { budget: { gasUsed: 0, hotelCost: 300, foodEstimate: 150, miscCost: 0, dayTotal: 450 } },
  { budget: { gasUsed: 0, hotelCost: 300, foodEstimate: 150, miscCost: 0, dayTotal: 450 } },
  { budget: { gasUsed: 0, hotelCost: 300, foodEstimate: 150, miscCost: 0, dayTotal: 450 } },
  { budget: { gasUsed: 104.5, hotelCost: 300, foodEstimate: 150, miscCost: 0, dayTotal: 560 } },
  { budget: { gasUsed: 104.5, hotelCost: 0, foodEstimate: 150, miscCost: 0, dayTotal: 260 } },
] as any[];

const costBreakdown = calculateCostBreakdown(days, 3);
console.log('Cost Breakdown Total:', costBreakdown.total);

// If the banner shows 110%, budget used (3290) / total = 1.10
// Then budget.total = 3290 / 1.10 = ~ 2990 ≈ 3000
const budget = {
  mode: 'plan-to-budget' as any,
  total: 3000,
  gas: 0, hotel: 0, food: 0, weights: { gas: 0, hotel: 0, food: 0 }
};

const status = getBudgetStatus(budget, costBreakdown);
console.log('Budget Limit:', budget.total);
console.log('Budget Status:', status);
console.log('Budget Remaining:', budget.total - costBreakdown.total);

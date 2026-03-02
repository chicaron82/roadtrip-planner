import { calculateCostBreakdown } from './src/lib/budget/summary';
import { calculateTotalBudgetUsed } from './src/lib/feasibility/helpers';

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

const userTotalBudget = 2000;

console.log('Cost Breakdown Total:', calculateCostBreakdown(days, 3).total);
console.log('Feasibility Engine Total:', calculateTotalBudgetUsed(days));

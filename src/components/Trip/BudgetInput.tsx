import { useState } from 'react';
import { DollarSign, Fuel, Hotel, Utensils, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Button } from '../UI/Button';
import type { TripBudget, BudgetMode, Currency } from '../../types';
import { cn } from '../../lib/utils';

interface BudgetInputProps {
  budget: TripBudget;
  onChange: (budget: TripBudget) => void;
  currency: Currency;
  className?: string;
}

const BUDGET_PRESETS = {
  budget: { gas: 300, hotel: 400, food: 200, misc: 100 },
  moderate: { gas: 500, hotel: 800, food: 400, misc: 200 },
  comfort: { gas: 600, hotel: 1200, food: 600, misc: 300 },
};

// Default distribution ratios when user enters total first
const DEFAULT_RATIOS = {
  gas: 0.35,    // 35% for fuel
  hotel: 0.40,  // 40% for accommodation
  food: 0.20,   // 20% for meals
  misc: 0.05,   // 5% for activities/misc
};

export function BudgetInput({ budget, onChange, currency, className }: BudgetInputProps) {
  const [isExpanded, setIsExpanded] = useState(budget.mode === 'plan-to-budget');
  const currencySymbol = currency === 'CAD' ? 'CA$' : '$';

  const updateBudget = (field: keyof Omit<TripBudget, 'mode' | 'total'>, value: number) => {
    const newBudget = { ...budget, [field]: value };
    newBudget.total = newBudget.gas + newBudget.hotel + newBudget.food + newBudget.misc;
    onChange(newBudget);
  };

  // Update total and distribute to categories
  const updateTotal = (newTotal: number) => {
    const currentSum = budget.gas + budget.hotel + budget.food + budget.misc;

    let newBudget: TripBudget;

    if (currentSum === 0) {
      // No existing values - use default ratios
      newBudget = {
        ...budget,
        gas: Math.round(newTotal * DEFAULT_RATIOS.gas),
        hotel: Math.round(newTotal * DEFAULT_RATIOS.hotel),
        food: Math.round(newTotal * DEFAULT_RATIOS.food),
        misc: Math.round(newTotal * DEFAULT_RATIOS.misc),
        total: newTotal,
      };
    } else {
      // Distribute proportionally based on current ratios
      const scale = newTotal / currentSum;
      newBudget = {
        ...budget,
        gas: Math.round(budget.gas * scale),
        hotel: Math.round(budget.hotel * scale),
        food: Math.round(budget.food * scale),
        misc: Math.round(budget.misc * scale),
        total: newTotal,
      };
    }

    // Adjust for rounding errors - add/subtract difference from largest category
    const actualSum = newBudget.gas + newBudget.hotel + newBudget.food + newBudget.misc;
    const diff = newTotal - actualSum;
    if (diff !== 0) {
      // Add rounding difference to hotel (usually the largest)
      newBudget.hotel += diff;
    }

    onChange(newBudget);
  };

  const setMode = (mode: BudgetMode) => {
    onChange({ ...budget, mode });
    if (mode === 'plan-to-budget') {
      setIsExpanded(true);
    }
  };

  const applyPreset = (preset: keyof typeof BUDGET_PRESETS) => {
    const values = BUDGET_PRESETS[preset];
    const newBudget: TripBudget = {
      ...budget,
      ...values,
      total: values.gas + values.hotel + values.food + values.misc,
    };
    onChange(newBudget);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Budget Mode Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Trip Budget</Label>
        <div className="flex-1" />
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setMode('open')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              budget.mode === 'open'
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            Show Costs
          </button>
          <button
            onClick={() => setMode('plan-to-budget')}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200",
              budget.mode === 'plan-to-budget'
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            Plan to Budget
          </button>
        </div>
      </div>

      {/* Budget Summary (collapsed view) */}
      {budget.mode === 'plan-to-budget' && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:border-green-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-green-800">
                Total Budget: {currencySymbol}{budget.total.toLocaleString()}
              </div>
              <div className="text-xs text-green-600">
                Gas: ${budget.gas} | Hotel: ${budget.hotel} | Food: ${budget.food}
              </div>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-green-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-green-600" />
          )}
        </button>
      )}

      {/* Expanded Budget Inputs */}
      {budget.mode === 'plan-to-budget' && isExpanded && (
        <div className="space-y-4 p-4 rounded-lg bg-gray-50 border border-gray-200 animate-in slide-in-from-top-2">
          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-gray-600">Quick Presets:</span>
            <div className="flex gap-2">
              {(Object.keys(BUDGET_PRESETS) as (keyof typeof BUDGET_PRESETS)[]).map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="text-xs capitalize h-7"
                >
                  {preset} (${BUDGET_PRESETS[preset].gas + BUDGET_PRESETS[preset].hotel + BUDGET_PRESETS[preset].food + BUDGET_PRESETS[preset].misc})
                </Button>
              ))}
            </div>
          </div>

          {/* Category Inputs */}
          <div className="grid grid-cols-2 gap-4">
            {/* Gas Budget */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5 text-orange-500" />
                Gas Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <Input
                  type="number"
                  value={budget.gas || ''}
                  onChange={(e) => updateBudget('gas', Number(e.target.value) || 0)}
                  className="pl-7 h-9"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Hotel Budget */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Hotel className="h-3.5 w-3.5 text-blue-500" />
                Hotel Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <Input
                  type="number"
                  value={budget.hotel || ''}
                  onChange={(e) => updateBudget('hotel', Number(e.target.value) || 0)}
                  className="pl-7 h-9"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Food Budget */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Utensils className="h-3.5 w-3.5 text-green-500" />
                Food Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <Input
                  type="number"
                  value={budget.food || ''}
                  onChange={(e) => updateBudget('food', Number(e.target.value) || 0)}
                  className="pl-7 h-9"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Misc Budget */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                Misc / Activities
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <Input
                  type="number"
                  value={budget.misc || ''}
                  onChange={(e) => updateBudget('misc', Number(e.target.value) || 0)}
                  className="pl-7 h-9"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Editable Total */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Total Trip Budget
                </Label>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Edit total to auto-distribute across categories
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-green-600">$</span>
                <Input
                  type="number"
                  value={budget.total || ''}
                  onChange={(e) => updateTotal(Number(e.target.value) || 0)}
                  className="pl-7 h-10 w-32 text-lg font-bold text-green-600 text-right border-green-200 focus:border-green-400 focus:ring-green-200"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Mode Info */}
      {budget.mode === 'open' && (
        <div className="text-xs text-gray-500 italic">
          Trip costs will be calculated and displayed after planning
        </div>
      )}
    </div>
  );
}

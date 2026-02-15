import { Fuel, Hotel, Utensils, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { DayBudget, BudgetMode } from '../../types';
import { cn } from '../../lib/utils';

interface DailyBudgetCardProps {
  budget: DayBudget;
  dayNumber: number;
  budgetMode: BudgetMode;
  className?: string;
}

export function DailyBudgetCard({ budget, dayNumber, budgetMode, className }: DailyBudgetCardProps) {
  const showRemaining = budgetMode === 'plan-to-budget';

  const getBudgetStatus = (remaining: number): { icon: React.ReactNode; color: string } => {
    if (remaining > 50) {
      return { icon: <TrendingDown className="h-3 w-3" />, color: 'text-green-600' };
    } else if (remaining > 0) {
      return { icon: <Minus className="h-3 w-3" />, color: 'text-amber-600' };
    } else {
      return { icon: <TrendingUp className="h-3 w-3" />, color: 'text-red-600' };
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4 mt-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Day {dayNumber} Budget Summary
        </span>
        <span className="text-sm font-bold text-gray-900">
          ${budget.dayTotal.toFixed(0)}
        </span>
      </div>

      {/* Cost Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Gas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
              <Fuel className="h-3 w-3 text-orange-600" />
            </div>
            <span className="text-xs text-gray-600">Gas Used</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">${budget.gasUsed.toFixed(0)}</span>
        </div>

        {/* Gas Remaining */}
        {showRemaining && (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs text-gray-500">Remaining:</span>
            <span className={cn("text-xs font-semibold flex items-center gap-0.5", getBudgetStatus(budget.gasRemaining).color)}>
              {getBudgetStatus(budget.gasRemaining).icon}
              ${budget.gasRemaining.toFixed(0)}
            </span>
          </div>
        )}

        {/* Hotel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <Hotel className="h-3 w-3 text-blue-600" />
            </div>
            <span className="text-xs text-gray-600">Hotel</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {budget.hotelCost > 0 ? `$${budget.hotelCost.toFixed(0)}` : '-'}
          </span>
        </div>

        {/* Hotel Remaining */}
        {showRemaining && (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs text-gray-500">Remaining:</span>
            <span className={cn("text-xs font-semibold flex items-center gap-0.5", getBudgetStatus(budget.hotelRemaining).color)}>
              {getBudgetStatus(budget.hotelRemaining).icon}
              ${budget.hotelRemaining.toFixed(0)}
            </span>
          </div>
        )}

        {/* Food */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
              <Utensils className="h-3 w-3 text-green-600" />
            </div>
            <span className="text-xs text-gray-600">Food Est.</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">${budget.foodEstimate.toFixed(0)}</span>
        </div>

        {/* Food Remaining */}
        {showRemaining && (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs text-gray-500">Remaining:</span>
            <span className={cn("text-xs font-semibold flex items-center gap-0.5", getBudgetStatus(budget.foodRemaining).color)}>
              {getBudgetStatus(budget.foodRemaining).icon}
              ${budget.foodRemaining.toFixed(0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact version for inline display
interface DailyBudgetBadgeProps {
  budget: DayBudget;
  className?: string;
}

export function DailyBudgetBadge({ budget, className }: DailyBudgetBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-3 py-1.5 rounded-full bg-gray-100 text-xs",
        className
      )}
    >
      <span className="flex items-center gap-1">
        <Fuel className="h-3 w-3 text-orange-500" />
        ${budget.gasUsed.toFixed(0)}
      </span>
      {budget.hotelCost > 0 && (
        <span className="flex items-center gap-1">
          <Hotel className="h-3 w-3 text-blue-500" />
          ${budget.hotelCost.toFixed(0)}
        </span>
      )}
      <span className="flex items-center gap-1">
        <Utensils className="h-3 w-3 text-green-500" />
        ${budget.foodEstimate.toFixed(0)}
      </span>
      <span className="font-semibold text-gray-700 border-l border-gray-300 pl-3">
        ${budget.dayTotal.toFixed(0)}
      </span>
    </div>
  );
}

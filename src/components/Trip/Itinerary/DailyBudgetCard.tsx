import { Fuel, Hotel, Utensils, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { DayBudget, BudgetMode } from '../../../types';
import { cn } from '../../../lib/utils';

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

  /** Formats a remaining value for display.
   *  Positive:  "Remaining: $150"
   *  Zero:      "Remaining: $0"
   *  Negative:  label becomes "Over by:" and shows "$275" (abs value, red)
   */
  const formatRemaining = (remaining: number): { label: string; text: string } => {
    if (remaining < 0) {
      return { label: 'Over by:', text: `$${Math.abs(remaining).toFixed(0)}` };
    }
    return { label: 'Remaining:', text: `$${remaining.toFixed(0)}` };
  };

  const getProgressBarColor = (used: number, remaining: number): string => {
    if (remaining < 0) return 'bg-red-500';
    const total = used + remaining;
    const percentUsed = total > 0 ? (used / total) * 100 : 0;
    if (percentUsed > 85) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getProgressPercent = (used: number, remaining: number): number => {
    if (remaining < 0) return 100;
    const total = used + remaining;
    if (total === 0) return 0;
    return Math.min((used / total) * 100, 100);
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-border bg-muted/20 p-4 mt-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Day {dayNumber} Budget Summary
        </span>
        <span className="text-sm font-bold text-foreground">
          ${budget.dayTotal.toFixed(0)}
        </span>
      </div>

      {/* Cost Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Gas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Fuel className="h-3 w-3 text-orange-500" />
            </div>
            <span className="text-xs text-muted-foreground">Gas Used</span>
          </div>
          <span className="text-sm font-semibold text-foreground">${budget.gasUsed.toFixed(0)}</span>
        </div>

        {/* Bank remaining — shown once after gas row when gas was used */}
        {showRemaining && budget.gasUsed > 0 && (
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs text-muted-foreground">{formatRemaining(budget.bankRemaining).label}</span>
            <span className={cn("text-xs font-semibold flex items-center gap-0.5", getBudgetStatus(budget.bankRemaining).color)}>
              {getBudgetStatus(budget.bankRemaining).icon}
              {formatRemaining(budget.bankRemaining).text}
            </span>
          </div>
        )}

        {/* Hotel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Hotel className="h-3 w-3 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Hotel</span>
          </div>
          <span className="text-sm font-semibold text-foreground">
            {budget.hotelCost > 0 ? `$${budget.hotelCost.toFixed(0)}` : '-'}
          </span>
        </div>


        {/* Food */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Utensils className="h-3 w-3 text-green-500" />
            </div>
            <span className="text-xs text-muted-foreground">Food Est.</span>
          </div>
          <span className="text-sm font-semibold text-foreground">${budget.foodEstimate.toFixed(0)}</span>
        </div>

      </div>

      {/* Trip Bank Progress Bar */}
      {showRemaining && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Trip Budget</span>
            <span className="text-[10px] font-semibold text-foreground">
              {getProgressPercent(budget.dayTotal, budget.bankRemaining).toFixed(0)}% used
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-500", getProgressBarColor(budget.dayTotal, budget.bankRemaining))}
              style={{ width: `${getProgressPercent(budget.dayTotal, budget.bankRemaining)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TripSummary, TripSettings } from '../../types';
import { computeSensitivity, getSensitivityStatus } from '../../lib/feasibility/sensitivity';
import { formatCurrency } from '../../lib/calculations';
import { cn } from '../../lib/utils';

interface BudgetSensitivityProps {
  summary: TripSummary;
  settings: TripSettings;
  className?: string;
}

export function BudgetSensitivity({ summary, settings, className }: BudgetSensitivityProps) {
  const [isOpen, setIsOpen] = useState(false);

  const scenarios = computeSensitivity(summary, settings);
  if (scenarios.length === 0) return null;

  const showPct = settings.budgetMode === 'plan-to-budget' && settings.budget.total > 0;

  const pctColor = (pct: number | null) => {
    const status = getSensitivityStatus(pct);
    if (status === 'red')   return 'text-red-600 font-semibold';
    if (status === 'amber') return 'text-amber-600 font-semibold';
    if (status === 'green') return 'text-green-600';
    return '';
  };

  return (
    <div className={cn('rounded-xl border border-border bg-muted/30', className)}>
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What-If Scenarios
        </span>
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>

      {isOpen && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-1.5 font-medium w-[40%]">Scenario</th>
                <th className="text-right pb-1.5 font-medium">Gas</th>
                <th className="text-right pb-1.5 font-medium">Hotel</th>
                <th className="text-right pb-1.5 font-medium">Total</th>
                {showPct && <th className="text-right pb-1.5 font-medium">%</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {scenarios.map(s => (
                <tr key={s.label} className="hover:bg-muted/40 transition-colors">
                  <td className="py-1.5 text-foreground font-medium">{s.label}</td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {formatCurrency(s.gasCost, settings.currency)}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {formatCurrency(s.hotelCost, settings.currency)}
                  </td>
                  <td className={cn('py-1.5 text-right', pctColor(s.pctOfBudget))}>
                    {formatCurrency(s.totalCost, settings.currency)}
                  </td>
                  {showPct && (
                    <td className={cn('py-1.5 text-right', pctColor(s.pctOfBudget))}>
                      {s.pctOfBudget !== null ? `${s.pctOfBudget}%` : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-muted-foreground/60 leading-tight">
            Estimates only. +10% Fuel simulates regional price spikes; +1 Night adds one unplanned overnight.
          </p>
        </div>
      )}
    </div>
  );
}

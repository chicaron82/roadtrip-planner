/**
 * TripBudgetHealth — Trip-level budget vs. estimate summary card.
 *
 * Shows per-category delta (budgeted vs. estimated) and a net trip
 * health summary. Surfaces the honest answer to "am I on track?"
 * without rebalancing or prescribing what to cut — just the math.
 *
 * Only renders in plan-to-budget mode when a cost breakdown exists.
 *
 * 💚 My Experience Engine
 */

import type { CostBreakdown, Currency } from '../../../types';
import type { TripBudget } from '../../../types/core';
import { formatCurrency } from '../../../lib/trip-formatters';

interface TripBudgetHealthProps {
  budget: TripBudget;
  breakdown: CostBreakdown;
  currency: Currency;
}

interface CategoryRow {
  label: string;
  emoji: string;
  budgeted: number;
  estimated: number;
  delta: number; // positive = under budget (good), negative = over budget (bad)
}

function buildRows(budget: TripBudget, breakdown: CostBreakdown): CategoryRow[] {
  const rows: CategoryRow[] = [
    { label: 'Gas',   emoji: '⛽', budgeted: budget.gas,   estimated: breakdown.fuel          ?? 0, delta: 0 },
    { label: 'Hotel', emoji: '🏨', budgeted: budget.hotel, estimated: breakdown.accommodation ?? 0, delta: 0 },
    { label: 'Food',  emoji: '🍽️', budgeted: budget.food,  estimated: breakdown.meals         ?? 0, delta: 0 },
  ];
  if (budget.misc > 0 || (breakdown.misc ?? 0) > 0) {
    rows.push({ label: 'Misc', emoji: '💳', budgeted: budget.misc, estimated: breakdown.misc ?? 0, delta: 0 });
  }
  return rows.map(r => ({ ...r, delta: r.budgeted - r.estimated }));
}

export function TripBudgetHealth({ budget, breakdown, currency }: TripBudgetHealthProps) {
  // Only meaningful when the user has actually set category budgets
  const totalBudgeted = budget.gas + budget.hotel + budget.food + budget.misc;
  if (totalBudgeted <= 0) return null;

  const rows = buildRows(budget, breakdown);
  const estimatedTotal = rows.reduce((s, r) => s + r.estimated, 0);
  const netDelta = totalBudgeted - estimatedTotal; // positive = under, negative = over

  const overRows  = rows.filter(r => r.budgeted > 0 && r.delta < 0);
  const underRows = rows.filter(r => r.budgeted > 0 && r.delta > 0);

  function statusInfo(): { label: string; color: string; bg: string; border: string } {
    if (netDelta > 50)  return { label: 'On Track',    color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)'  };
    if (netDelta >= 0)  return { label: 'Tight',       color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' };
    if (netDelta > -100)return { label: 'Slightly Over', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' };
    return                     { label: 'Over Budget', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  };
  }

  const status = statusInfo();

  function buildNarrativeLine(): string {
    if (overRows.length === 0) return `Estimated spend fits within your ${formatCurrency(totalBudgeted, currency)} budget.`;

    const overNames  = overRows.map(r => r.label).join(' & ');
    const underNames = underRows.map(r => r.label).join(' & ');

    if (netDelta >= 0) {
      return `${overNames} runs over, but ${underNames} surplus covers it — net ${formatCurrency(Math.abs(netDelta), currency)} to spare.`;
    }
    const gap = formatCurrency(Math.abs(netDelta), currency);
    if (underRows.length > 0) {
      return `${overNames} runs over; ${underNames} cushions some of it — still ${gap} short overall.`;
    }
    return `Estimated spend exceeds budget by ${gap}.`;
  }

  const fmt = (n: number) => formatCurrency(n, currency);

  return (
    <div
      className="rounded-xl border px-4 py-3 space-y-3"
      style={{ background: status.bg, borderColor: status.border }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: status.color }}
        >
          Budget Health
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
        >
          {status.label}
        </span>
      </div>

      {/* Category table */}
      <div className="space-y-1.5">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-1">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40" />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 text-right w-14">Budget</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 text-right w-14">Est.</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40 text-right w-14">Delta</span>
        </div>

        {rows.map(row => {
          if (row.budgeted === 0 && row.estimated === 0) return null;
          const positive = row.delta >= 0;
          const deltaColor = row.budgeted === 0 ? '#6b7280'
            : positive ? '#22c55e' : '#ef4444';
          return (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center rounded-lg px-2 py-1.5"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs text-foreground/70">
                {row.emoji} {row.label}
              </span>
              <span className="text-xs font-mono text-right w-14 text-muted-foreground">
                {row.budgeted > 0 ? fmt(row.budgeted) : '—'}
              </span>
              <span className="text-xs font-mono text-right w-14 text-foreground/80">
                {fmt(row.estimated)}
              </span>
              <span
                className="text-xs font-mono font-semibold text-right w-14"
                style={{ color: deltaColor }}
              >
                {row.budgeted === 0 ? '—'
                  : positive ? `+${fmt(row.delta)}`
                  : `-${fmt(Math.abs(row.delta))}`}
              </span>
            </div>
          );
        })}

        {/* Net row */}
        <div
          className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center rounded-lg px-2 py-1.5 border-t mt-1 pt-2"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <span className="text-xs font-semibold text-foreground/80">Total</span>
          <span className="text-xs font-mono font-semibold text-right w-14 text-foreground/70">
            {fmt(totalBudgeted)}
          </span>
          <span className="text-xs font-mono font-semibold text-right w-14 text-foreground/80">
            {fmt(estimatedTotal)}
          </span>
          <span
            className="text-xs font-mono font-bold text-right w-14"
            style={{ color: status.color }}
          >
            {netDelta >= 0 ? `+${fmt(netDelta)}` : `-${fmt(Math.abs(netDelta))}`}
          </span>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        {buildNarrativeLine()}
      </p>
    </div>
  );
}

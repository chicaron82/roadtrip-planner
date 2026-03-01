/**
 * BudgetBar — Animated segmented bar showing fuel / hotel / meals cost split.
 *
 * Renders three coloured segments proportional to each category.
 * Animates in on mount via CSS `transition-all duration-700`.
 *
 * 💚 My Experience Engine
 */

import { useState, useEffect } from 'react';
import type { CostBreakdown } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import type { TripSettings } from '../../types';

interface BudgetBarProps {
  breakdown: CostBreakdown;
  settings: TripSettings;
}

const SEGMENTS = [
  { key: 'fuel',          label: 'Fuel',     color: '#f97316' },
  { key: 'accommodation', label: 'Hotel',    color: '#3b82f6' },
  { key: 'meals',         label: 'Meals',    color: '#22c55e' },
] as const;

export function BudgetBar({ breakdown, settings }: BudgetBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  const total = (breakdown.fuel ?? 0) + (breakdown.accommodation ?? 0) + (breakdown.meals ?? 0);
  if (total <= 0) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2.5 space-y-2"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
        <span>Trip Budget Breakdown</span>
        <span className="font-mono">{formatCurrency(total, settings.currency)}</span>
      </div>

      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {SEGMENTS.map(seg => {
          const val = breakdown[seg.key] ?? 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          return (
            <div
              key={seg.key}
              className="h-full rounded-sm transition-all duration-700 ease-out"
              style={{
                background: seg.color,
                width: mounted ? `${pct}%` : '0%',
                opacity: pct > 0 ? 1 : 0,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {SEGMENTS.map(seg => {
          const val = breakdown[seg.key] ?? 0;
          if (val <= 0) return null;
          return (
            <div key={seg.key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: seg.color }} />
              <span className="text-[10px] text-muted-foreground/70">
                {seg.label} <span className="font-mono font-medium text-foreground/60">{formatCurrency(val, settings.currency)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

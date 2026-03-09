/**
 * FuelGauge.tsx — Segmented E–F tank level indicator for fuel stop cards.
 *
 * Extracted from SuggestedStopCard to keep that file under 300 lines.
 * 10 segments, colour-coded fill (green/amber/red at 50%/25%),
 * animated on mount with a 30ms per-segment stagger at 400ms ease-out.
 */

import { useState, useEffect } from 'react';
import type { SuggestedStop } from '../../../lib/stop-suggestions';

export interface FuelGaugeProps {
  tankPercent: number;
  priority: SuggestedStop['priority'];
  fillType?: 'full' | 'topup';
  comboMeal?: boolean;
}

export function FuelGauge({ tankPercent, priority, fillType, comboMeal }: FuelGaugeProps) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 50);
    return () => clearTimeout(t);
  }, []);

  const pct = Math.max(0, Math.min(100, tankPercent));
  const filledSegments = Math.round((pct / 100) * 10);
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
  const label = priority === 'required'
    ? 'REQUIRED STOP'
    : comboMeal
    ? 'FUEL + MEAL'
    : fillType === 'topup'
    ? 'TOP-UP COMFORT'
    : 'FUEL STOP';

  return (
    <div className="flex items-center gap-1.5 my-2">
      <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">E</span>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '8px',
              borderRadius: '2px',
              backgroundColor: filled && i < filledSegments ? color : 'rgba(255,255,255,0.08)',
              transition: 'background-color 400ms ease-out',
              transitionDelay: filled ? `${i * 30}ms` : '0ms',
            }}
          />
        ))}
      </div>
      <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">F</span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
        {pct}% · {label}
      </span>
    </div>
  );
}

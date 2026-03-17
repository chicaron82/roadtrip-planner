/**
 * LiveReflectionBar — "Build Your MEE Time" persistent estimate strip.
 *
 * Shows at Step 2+ after the first route calculation. Gives the user a live
 * read of ~cost / days / drive time + a budget distribution bar so every
 * vehicle or settings change has immediate visible feedback.
 *
 * Uses estimate-service.ts (pure math, no OSRM re-call) — updates instantly.
 *
 * 💚 My Experience Engine
 */

import { useMemo } from 'react';
import type { TripSummary, Vehicle, TripSettings } from '../../types';
import { generateEstimate } from '../../lib/estimate-service';
import { formatHoursFromMinutes } from '../../lib/utils';

interface LiveReflectionBarProps {
  summary: TripSummary;
  vehicle: Vehicle;
  settings: TripSettings;
}

const CATEGORY_COLORS = ['#ea580c', '#7c3aed', '#16a34a', '#0891b2'] as const;

export function LiveReflectionBar({ summary, vehicle, settings }: LiveReflectionBarProps) {
  const estimate = useMemo(
    () => generateEstimate(summary, vehicle, settings),
    [summary, vehicle, settings],
  );

  const days = estimate.days;
  const driveMinutes = Math.round(summary.totalDurationMinutes);
  const driveLabel = formatHoursFromMinutes(driveMinutes);
  const totals = [estimate.breakdown[0].mid, estimate.breakdown[1].mid, estimate.breakdown[2].mid, estimate.breakdown[3].mid];
  const total = totals.reduce((a, b) => a + b, 0);
  const percents = totals.map(v => total > 0 ? (v / total) * 100 : 25);

  return (
    <div style={{
      padding: '10px 16px 8px',
      background: 'rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      flexShrink: 0,
    }}>
      {/* Summary line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 6 }}>
        <span style={{ color: '#f5f0e8', fontSize: '14px', fontWeight: 700 }}>
          ~{estimate.currency}{estimate.totalMid.toLocaleString()} est.
        </span>
        <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: '13px' }}>·</span>
        <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: '13px' }}>
          {days} day{days !== 1 ? 's' : ''}
        </span>
        <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: '13px' }}>·</span>
        <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: '13px' }}>
          {driveLabel} driving
        </span>
      </div>

      {/* Distribution bar */}
      <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {percents.map((pct, i) => (
          <div
            key={i}
            style={{ flex: pct, background: CATEGORY_COLORS[i], opacity: 0.75, minWidth: 4 }}
          />
        ))}
      </div>

      {/* Category labels */}
      <div style={{ display: 'flex', gap: '12px', marginTop: 5 }}>
        {['⛽', '🏨', '🍽️', '🎯'].map((emoji, i) => (
          <span key={i} style={{ color: 'rgba(245,240,232,0.4)', fontSize: '11px' }}>
            {emoji} {Math.round(percents[i])}%
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'rgba(245,240,232,0.25)', fontSize: '10px' }}>
          per person ~{estimate.currency}{estimate.perPersonMid}
        </span>
      </div>
    </div>
  );
}

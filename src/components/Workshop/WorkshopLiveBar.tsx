/**
 * WorkshopLiveBar — Pinned live estimate bar.
 *
 * Always visible at the top of any workshop surface.
 * Updates instantly on every control change — pure math, no API call.
 *
 * 💚 My Experience Engine — Workshop live anchor
 */

import { CATEGORY_COLORS } from '../Icebreaker/useWorkshopPresets';
import type { WorkshopPresetsResult } from '../Icebreaker/useWorkshopPresets';

interface WorkshopLiveBarProps {
  estimate: WorkshopPresetsResult['estimate'];
  driveLabel: string;
  percents: number[];
  multiPerson: boolean;
}

export function WorkshopLiveBar({ estimate, driveLabel, percents, multiPerson }: WorkshopLiveBarProps) {
  return (
    <div style={{
      padding: '12px 20px 10px',
      background: 'rgba(255, 255, 255, 0.03)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '20px 20px 0 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: '#f5f0e8', fontSize: 14, fontWeight: 700 }}>
          {multiPerson
            ? `~${estimate.currency}${estimate.perPersonMid.toLocaleString()}/person`
            : `~${estimate.currency}${estimate.totalMid.toLocaleString()} est.`
          }
        </span>
        {multiPerson && (
          <>
            <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>·</span>
            <span style={{ color: 'rgba(245,240,232,0.45)', fontSize: 13 }}>
              {estimate.currency}{estimate.totalMid.toLocaleString()} total
            </span>
          </>
        )}
        <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>·</span>
        <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13 }}>
          {estimate.days} day{estimate.days !== 1 ? 's' : ''}
        </span>
        <span style={{ color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>·</span>
        <span style={{ color: 'rgba(245,240,232,0.55)', fontSize: 13 }}>
          {driveLabel} driving
        </span>
      </div>

      <div style={{ display: 'flex', height: 4, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {percents.map((pct, i) => (
          <div key={i} style={{ flex: pct, background: CATEGORY_COLORS[i], opacity: 0.75, minWidth: 4 }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
        {['⛽', '🏨', '🍽️', '🎯'].map((emoji, i) => (
          <span key={i} style={{ color: 'rgba(245,240,232,0.4)', fontSize: 11 }}>
            {emoji} {Math.round(percents[i])}%
          </span>
        ))}
        {!multiPerson && (
          <span style={{ marginLeft: 'auto', color: 'rgba(245,240,232,0.25)', fontSize: 10 }}>
            per person ~{estimate.currency}{estimate.perPersonMid}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * VoilaDashboard — Three chips. No more, ever.
 *
 * First-breath truths of the trip:
 *   - Days / Nights
 *   - Hero Cost (solo = total, group = per person)
 *   - Travelers (hidden for solo — implicit)
 *
 * 💚 My Experience Engine — The sacred three
 */

import type { TripSummary, TripSettings } from '../../types';
import { getTripDayCounts } from '../../lib/trip-summary-view';

interface VoilaDashboardProps {
  summary: TripSummary;
  settings: TripSettings;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 16px',
      background: 'rgba(245, 240, 232, 0.06)',
      border: '1px solid rgba(245, 240, 232, 0.1)',
      borderRadius: 100,
      fontFamily: '"DM Sans", system-ui, sans-serif',
      fontSize: 14,
      color: '#f5f0e8',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </div>
  );
}

export function VoilaDashboard({ summary, settings }: VoilaDashboardProps) {
  const { totalDays } = getTripDayCounts(summary);
  const days = totalDays;
  const nights = Math.max(0, days - 1);
  const currency = settings.currency === 'USD' ? '$' : 'C$';
  const numTravelers = settings.numTravelers ?? 1;
  const isSolo = numTravelers <= 1;

  const totalCost = summary.costBreakdown ? Math.round(summary.costBreakdown.total) : null;
  const perPersonCost = totalCost && numTravelers > 1 ? Math.round(totalCost / numTravelers) : null;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      padding: '0 28px 28px',
    }}>
      {/* Chip 1 — Days / Nights */}
      <Chip>{nights === 0 ? 'Day Trip' : `${days}d · ${nights}n`}</Chip>

      {/* Chip 2 — Hero Cost */}
      {totalCost && (
        <Chip>
          {isSolo
            ? `${currency}${totalCost.toLocaleString()}`
            : `${currency}${perPersonCost?.toLocaleString()}/person`
          }
        </Chip>
      )}

      {/* Chip 3 — Travelers (hidden for solo) */}
      {!isSolo && (
        <Chip>{numTravelers} travelers</Chip>
      )}
    </div>
  );
}

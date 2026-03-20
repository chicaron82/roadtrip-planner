/**
 * VoilaCardRail — Scrollable card exploration layer.
 *
 * CSS scroll-snap. One card at a time + peek affordance (~15% of next card).
 * Tier A cards open detail panels. Tier B (Trip Snapshot) opens grouped view.
 *
 * Rail order: Budget → Itinerary → Stops → Trip Snapshot (peek)
 *
 * 💚 My Experience Engine — Voilà card rail
 */

import type { TripSummary, TripSettings } from '../../types';

type DetailCard = 'itinerary' | 'snapshot';

interface VoilaCardRailProps {
  summary: TripSummary;
  settings: TripSettings;
  onOpenDetail: (card: DetailCard) => void;
}

interface CardProps {
  label: string;
  preview: string;
  sub?: string;
  onClick: () => void;
  accent?: string;
}

function Card({ label, preview, sub, onClick, accent = '#f5f0e8' }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 'calc(85% - 8px)',
        scrollSnapAlign: 'start',
        background: 'rgba(245, 240, 232, 0.05)',
        border: '1px solid rgba(245, 240, 232, 0.09)',
        borderRadius: 16,
        padding: '20px 20px 16px',
        cursor: 'pointer',
        transition: 'background 150ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245, 240, 232, 0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245, 240, 232, 0.05)')}
    >
      <p style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'rgba(245, 240, 232, 0.4)',
        margin: '0 0 8px',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 22,
        fontWeight: 600,
        color: accent,
        margin: '0 0 4px',
        lineHeight: 1.2,
      }}>
        {preview}
      </p>
      {sub && (
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13,
          color: 'rgba(245, 240, 232, 0.45)',
          margin: 0,
        }}>
          {sub} →
        </p>
      )}
    </div>
  );
}

export function VoilaCardRail({ summary, settings, onOpenDetail }: VoilaCardRailProps) {
  const currency = settings.currency === 'USD' ? '$' : 'C$';
  const numTravelers = settings.numTravelers ?? 1;
  const isSolo = numTravelers <= 1;
  const totalCost = summary.costBreakdown ? Math.round(summary.costBreakdown.total) : null;
  const perPerson = totalCost && !isSolo ? Math.round(totalCost / numTravelers) : null;

  const budgetPreview = totalCost
    ? isSolo
      ? `${currency}${totalCost.toLocaleString()}`
      : `${currency}${perPerson?.toLocaleString()}/person`
    : 'No estimate';

  const itineraryPreview = `${summary.drivingDays} day${summary.drivingDays !== 1 ? 's' : ''} planned`;
  const stopsCount = summary.segments?.length ?? 0;

  return (
    <div style={{ padding: '0 0 8px' }}>
      <p style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 12,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(245, 240, 232, 0.35)',
        margin: '0 0 12px',
        paddingLeft: 20,
      }}>
        Explore your trip →
      </p>

      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollPadding: '0 20px',
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {/* Budget — Tier A */}
        <Card
          label="Budget"
          preview={budgetPreview}
          sub="Hotels + fuel"
          onClick={() => onOpenDetail('snapshot')}
          accent="#f5f0e8"
        />

        {/* Itinerary — Tier A */}
        <Card
          label="Itinerary"
          preview={itineraryPreview}
          sub="Tap to explore"
          onClick={() => onOpenDetail('itinerary')}
        />

        {/* Stops — Tier A (simplified preview) */}
        {stopsCount > 0 && (
          <Card
            label="Stops & Discoveries"
            preview={`${stopsCount} segment${stopsCount !== 1 ? 's' : ''}`}
            sub="Along the route"
            onClick={() => onOpenDetail('snapshot')}
          />
        )}

        {/* Trip Snapshot — Tier B */}
        <Card
          label="Trip Snapshot"
          preview="At a glance"
          sub="Pace · fuel · rooms"
          onClick={() => onOpenDetail('snapshot')}
        />
      </div>
    </div>
  );
}

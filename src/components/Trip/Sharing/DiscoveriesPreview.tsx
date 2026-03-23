/**
 * DiscoveriesPreview — Collapsed preview of journal recommendations being shared.
 *
 * Shows only entries with a rating OR isHighlight — same filter as the
 * template export recommendations logic. The author sees exactly what
 * they're passing on before it leaves.
 *
 * 💚 My Experience Engine
 */

import type { TripJournal } from '../../../types';

interface DiscoveriesPreviewProps {
  journal: TripJournal;
}

function stars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export function DiscoveriesPreview({ journal }: DiscoveriesPreviewProps) {
  const items = journal.entries.filter(e => e.rating || e.isHighlight);

  if (items.length === 0) return null;

  return (
    <div style={{
      marginTop: 8,
      padding: '10px 12px',
      background: 'rgba(245, 240, 232, 0.04)',
      borderRadius: 8,
      border: '1px solid rgba(245, 240, 232, 0.08)',
    }}>
      <div style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 11,
        color: 'rgba(245, 240, 232, 0.35)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        What you&apos;re sharing
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.slice(0, 4).map((entry, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>
                {entry.isHighlight ? '★' : '📍'}
              </span>
              {entry.isHighlight && (
                <span style={{
                  fontSize: 10,
                  color: '#f97316',
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  background: 'rgba(249, 115, 22, 0.12)',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}>
                  highlight
                </span>
              )}
              {entry.rating && (
                <span style={{ fontSize: 11, color: '#f59e0b', letterSpacing: '-0.05em' }}>
                  {stars(entry.rating)}
                </span>
              )}
            </div>
            {entry.notes && (
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 12,
                color: 'rgba(245, 240, 232, 0.6)',
                margin: 0,
                paddingLeft: 18,
                lineHeight: 1.4,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}>
                &ldquo;{entry.notes}&rdquo;
              </p>
            )}
          </div>
        ))}
        {items.length > 4 && (
          <p style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 11,
            color: 'rgba(245, 240, 232, 0.3)',
            margin: 0,
          }}>
            + {items.length - 4} more
          </p>
        )}
      </div>
    </div>
  );
}

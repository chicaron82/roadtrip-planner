/**
 * ItineraryDetailPanel — Tier A fullscreen itinerary detail.
 *
 * Shows the day-by-day breakdown with ← Back to return to VoilaScreen.
 * Each day: date + route, drive time + distance, overnight city.
 *
 * 💚 My Experience Engine — Voilà Tier A
 */

import type { TripSummary, TripDay, TripSettings } from '../../types';
import { formatHoursFromMinutes } from '../../lib/utils';
import { BudgetSensitivity } from '../Trip/Budget/BudgetSensitivity';

interface ItineraryDetailPanelProps {
  summary: TripSummary;
  settings: TripSettings;
  onBack: () => void;
  onLockIn: () => void;
  onEditTrip: () => void;
}

export function ItineraryDetailPanel({ summary, settings, onBack, onLockIn, onEditTrip }: ItineraryDetailPanelProps) {
  const days: TripDay[] = summary.days ?? [];

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      background: 'rgba(14, 11, 7, 0.96)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(245, 240, 232, 0.07)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(245, 240, 232, 0.55)',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 14,
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          ← Back
        </button>
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(245, 240, 232, 0.4)',
          margin: 0,
        }}>
          Itinerary
        </p>
        <div style={{ width: 48 }} />
      </div>

      {/* Day list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {days.length > 0 ? days.map((day: TripDay, i: number) => {
          const overnightCity = day.overnight?.location.name?.split(',')[0].trim();
          return (
            <div key={i} style={{
              padding: '18px 20px',
              borderBottom: '1px solid rgba(245, 240, 232, 0.05)',
            }}>
              {/* Day label + date */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <p style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#f97316',
                  margin: 0,
                }}>
                  Day {day.dayNumber}
                </p>
                {day.dateFormatted && (
                  <p style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 11,
                    color: 'rgba(245, 240, 232, 0.3)',
                    margin: 0,
                  }}>
                    {day.dateFormatted}
                  </p>
                )}
              </div>

              {/* Route / title */}
              <p style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: 20,
                fontWeight: 600,
                color: '#f5f0e8',
                margin: '0 0 6px',
                lineHeight: 1.2,
              }}>
                {day.title ?? day.route}
              </p>

              {/* Drive stats */}
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                color: 'rgba(245, 240, 232, 0.4)',
                margin: overnightCity ? '0 0 4px' : 0,
              }}>
                {formatHoursFromMinutes(Math.round(day.totals.driveTimeMinutes))} driving
                {` · ${Math.round(day.totals.distanceKm).toLocaleString()} km`}
              </p>

              {/* Overnight city */}
              {overnightCity && (
                <p style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 12,
                  color: 'rgba(245, 240, 232, 0.3)',
                  margin: 0,
                }}>
                  Overnight · {overnightCity}
                </p>
              )}
            </div>
          );
        }) : (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: 18,
              color: 'rgba(245, 240, 232, 0.35)',
              margin: 0,
            }}>
              {summary.drivingDays} day{summary.drivingDays !== 1 ? 's' : ''} · {Math.round(summary.totalDistanceKm).toLocaleString()} km total
            </p>
          </div>
        )}
      </div>

      {/* What-If Scenarios */}
      {summary.costBreakdown && (
        <div style={{ padding: '0 20px 16px' }}>
          <BudgetSensitivity
            summary={summary}
            settings={settings}
            className="mt-4"
          />
        </div>
      )}

      {/* Sticky bottom */}
      <div style={{
        display: 'flex',
        gap: 10,
        padding: '12px 16px',
        borderTop: '1px solid rgba(245, 240, 232, 0.07)',
        flexShrink: 0,
      }}>
        <button
          onClick={onEditTrip}
          style={{
            flex: 1,
            padding: '13px 0',
            background: 'rgba(245, 240, 232, 0.06)',
            border: '1px solid rgba(245, 240, 232, 0.1)',
            borderRadius: 12,
            color: '#f5f0e8',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Let MEE make it better
        </button>
        <button
          onClick={onLockIn}
          style={{
            flex: 1,
            padding: '13px 0',
            background: '#f97316',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Lock it in →
        </button>
      </div>
    </div>
  );
}

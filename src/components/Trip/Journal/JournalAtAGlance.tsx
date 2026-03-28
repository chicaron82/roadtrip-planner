/**
 * JournalAtAGlance — post-lock-in confirmed trip surface.
 *
 * The moment the car arrives. Shows the live trip track (or pending state),
 * route + summary header, and the full JournalTimeline for notes and arrivals.
 *
 * Replaces Step 3 as the default post-lock-in landing screen.
 * Step 3 remains accessible via "Full details →" for power users.
 *
 * Self-contained: receives ghostCar directly so it doesn't need PlannerProvider.
 *
 * 💚 My Experience Engine
 */

import { lazy, Suspense, useMemo } from 'react';
import { CarTrack } from '../../UI/CarTrack';
import type { TripSummary, TripSettings, TripJournal } from '../../../types';
import type { GhostCarState } from '../../../hooks/journey/useGhostCar';

const JournalTimeline = lazy(() =>
  import('./JournalTimeline').then(m => ({ default: m.JournalTimeline })),
);

// ── Props ──────────────────────────────────────────────────────────────────

interface JournalAtAGlanceProps {
  summary: TripSummary;
  settings: TripSettings;
  /** Always non-null when this component renders — auto-started on lock-in. */
  activeJournal: TripJournal;
  ghostCar: GhostCarState;
  onUpdateJournal: (journal: TripJournal) => void;
  onViewFullDetails: () => void;
  onComplete: () => void;
  onShare: () => void;
  /** Seal the journal as a read-only souvenir. */
  onFinalize?: () => void;
  /** Minimize journal back to voila screen. */
  onMinimize?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatArrivalTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function buildRouteLabel(summary: TripSummary, fallback: string): string {
  const dayRoute = summary.days?.[0]?.route;
  if (dayRoute) {
    // Round trip: days[0].route is computed as "Origin → Origin" (same city).
    // Derive a better label from segments: origin → outbound destination.
    const parts = dayRoute.split(' → ');
    if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
      const segs = summary.segments;
      const midpoint = summary.roundTripMidpoint;
      const outboundEnd = midpoint != null
        ? segs[midpoint - 1]?.to.name
        : segs[Math.floor(segs.length / 2) - 1]?.to.name;
      if (outboundEnd) return `${parts[0].trim()} → ${outboundEnd}`;
    }
    return dayRoute;
  }
  return fallback;
}

function buildSummaryChips(summary: TripSummary): string {
  const nights = (summary.drivingDays ?? 1) - 1;
  const parts: string[] = [
    nights === 0 ? 'Day Trip' : `${summary.drivingDays}d · ${nights}n`,
    `${Math.round(summary.totalDistanceKm)} km`,
  ];
  const arrival = summary.days?.[0]?.totals.arrivalTime;
  if (arrival) parts.push(`~${formatArrivalTime(arrival)} arrival`);
  return parts.join(' · ');
}

// ── Component ──────────────────────────────────────────────────────────────

export function JournalAtAGlance({
  summary,
  settings,
  activeJournal,
  ghostCar,
  onUpdateJournal,
  onViewFullDetails,
  onComplete,
  onShare,
  onFinalize,
  onMinimize,
}: JournalAtAGlanceProps) {
  const routeLabel = buildRouteLabel(summary, activeJournal.metadata.title ?? 'Your Trip');
  const chips = buildSummaryChips(summary);

  const isComplete = useMemo(() => {
    const realIndices = new Set(
      summary.segments
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !s.to.id?.startsWith('guard-'))
        .map(({ i }) => i),
    );
    if (realIndices.size === 0) return false;
    const visited = activeJournal.entries.filter(
      e => realIndices.has(e.segmentIndex) && e.status === 'visited',
    ).length;
    return visited >= realIndices.size;
  }, [summary.segments, activeJournal.entries]);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      style={{ background: 'rgba(14, 11, 7, 0.94)' }}
    >
      {/* ── Live trip track / Parked car ── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3 border-b border-white/5"
        style={{ background: 'rgba(14, 11, 7, 0.6)' }}
      >
        {activeJournal.finalized ? (
          /* Parked car — trip complete */
          <div className="relative" style={{ height: 28 }}>
            <div
              className="absolute rounded-full"
              style={{
                top: '50%', left: 0, right: 0, height: 2,
                transform: 'translateY(-50%)',
                background: 'linear-gradient(90deg, rgba(74,222,128,0.4), rgba(74,222,128,0.8))',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                top: '50%', left: 0,
                width: 8, height: 8,
                transform: 'translate(-50%, -50%)',
                background: '#4ade80',
                boxShadow: '0 0 6px rgba(74,222,128,0.7)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                right: 0,
                transform: 'translate(50%, -60%)',
                fontSize: 18,
                filter: 'drop-shadow(0 2px 6px rgba(74,222,128,0.4))',
              }}
            >
              🚗
            </div>
            <div
              className="absolute rounded-full"
              style={{
                top: '50%', right: 0,
                width: 10, height: 10,
                transform: 'translate(50%, -50%)',
                background: '#22c55e',
                boxShadow: '0 0 10px rgba(74,222,128,0.9)',
              }}
            />
          </div>
        ) : ghostCar.windowStops ? (
          <CarTrack
            mode="trip"
            windowStops={ghostCar.windowStops}
            progressPct={ghostCar.progressPct}
            pending={!ghostCar.tripStarted}
          />
        ) : (
          <div
            style={{
              fontSize: '11px',
              color: 'rgba(245, 240, 232, 0.4)',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '8px 0',
            }}
          >
            🚗 Trip confirmed · {ghostCar.startsIn ?? 'departure pending'}
          </div>
        )}
      </div>

      {/* ── Route summary header ── */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h1
          style={{
            fontSize: 'clamp(22px, 5vw, 32px)',
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 600,
            color: '#f5f0e8',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {activeJournal.metadata.title}
        </h1>
        <p
          style={{
            fontSize: '12px',
            fontFamily: "'Cormorant Garamond', serif",
            color: 'rgba(245, 240, 232, 0.55)',
            margin: '4px 0 0',
            lineHeight: 1.3,
          }}
        >
          {routeLabel}
        </p>
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(245, 240, 232, 0.4)',
            fontFamily: "'DM Mono', monospace",
            margin: '2px 0 0',
            letterSpacing: '0.04em',
          }}
        >
          {chips}
        </p>
      </div>

      {/* ── Journal timeline — scrollable body ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <Suspense
          fallback={
            <div
              style={{
                padding: '32px 0',
                textAlign: 'center',
                fontSize: '13px',
                color: 'rgba(245, 240, 232, 0.35)',
              }}
            >
              Loading journal…
            </div>
          }
        >
          <JournalTimeline
            summary={summary}
            settings={settings}
            journal={activeJournal}
            onUpdateJournal={onUpdateJournal}
            hideFloatingAdd
            onFinalize={onFinalize}
          />
        </Suspense>
      </div>

      {/* ── Sticky bottom bar ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-white/5"
        style={{ background: 'rgba(14, 11, 7, 0.85)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onMinimize && (
            <button
              onClick={onMinimize}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(245, 240, 232, 0.4)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px 0',
                lineHeight: 1,
              }}
              title="Minimize to trip overview"
            >
              ▾
            </button>
          )}
          <button
            onClick={onViewFullDetails}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 240, 232, 0.4)',
              fontSize: '12px',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.04em',
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Full details →
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onShare}
            style={{
              background: 'none',
              border: '1px solid rgba(245, 240, 232, 0.15)',
              borderRadius: '8px',
              color: 'rgba(245, 240, 232, 0.6)',
              fontSize: '12px',
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0.04em',
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            Share
          </button>

          {isComplete && (
            <button
              onClick={onComplete}
              style={{
                background: 'rgba(234, 88, 12, 0.85)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '0.04em',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 14px',
              }}
            >
              Complete trip →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

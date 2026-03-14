/**
 * TripSignatureCard — Signature Premium Trip Summary Card
 *
 * The hero cover page of the journey. Dumb renderer — receives a SignatureCardModel
 * and plates it. All logic lives in buildSignatureCardModel().
 *
 * Hierarchy (spec-mandated, top → bottom):
 *   1. Title (hero)
 *   2. Subtitle
 *   3. Trip Read sentence
 *   4. Route label
 *   5. Core metrics
 *   6. Health phrase chip
 *
 * Visual tone: dark premium glass, warm cream text, breathing room, no badge soup.
 */

import type { SignatureCardModel } from '../../lib/trip-signature-card-model';

// ─── Colour tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:            'rgba(13, 13, 16, 0.95)',
  border:        'rgba(245, 240, 232, 0.09)',
  cream:         'rgba(245, 240, 232, 0.92)',
  creamMid:      'rgba(245, 240, 232, 0.60)',
  creamMuted:    'rgba(245, 240, 232, 0.38)',
  creamFaint:    'rgba(245, 240, 232, 0.18)',
  accent:        'rgba(251, 191, 36, 0.85)',   // warm amber — MEE identity
  accentFaint:   'rgba(251, 191, 36, 0.12)',
  divider:       'rgba(245, 240, 232, 0.07)',
} as const;

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col items-center px-3 py-2 rounded-xl"
      style={{ background: C.creamFaint, border: `1px solid ${C.divider}` }}
    >
      <span
        className="text-[10px] uppercase tracking-widest font-medium mb-0.5"
        style={{ color: C.creamMuted }}
      >
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: C.cream, fontFamily: "'DM Sans', sans-serif" }}
      >
        {value}
      </span>
    </div>
  );
}

function HealthChip({ phrase }: { phrase: SignatureCardModel['healthPhrase'] }) {
  const isWarning = phrase === 'Over budget — worth reviewing';
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{
        background: isWarning ? 'rgba(239, 68, 68, 0.12)' : C.accentFaint,
        border: `1px solid ${isWarning ? 'rgba(239, 68, 68, 0.25)' : 'rgba(251, 191, 36, 0.22)'}`,
        color: isWarning ? '#f87171' : C.accent,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: isWarning ? '#f87171' : C.accent }}
      />
      {phrase}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface TripSignatureCardProps {
  model: SignatureCardModel;
  /** Optional extra className for outer wrapper (e.g. margins) */
  className?: string;
}

export function TripSignatureCard({ model, className = '' }: TripSignatureCardProps) {
  const { title, subtitle, routeLabel, tripRead, healthPhrase, metrics } = model;

  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Top section: title + subtitle ─────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        {/* Title — the hero */}
        <h2
          className="text-2xl font-bold leading-tight mb-1"
          style={{
            color: C.cream,
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>

        {/* Subtitle — authorship + date */}
        <p
          className="text-[13px] font-normal"
          style={{ color: C.creamMuted }}
        >
          {subtitle}
        </p>
      </div>

      {/* ── Divider ────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: C.divider, margin: '0 24px' }} />

      {/* ── Middle section: trip read + route ─────────────────────── */}
      <div className="px-6 py-4">
        {/* Trip Read — editorial soul of the card */}
        <p
          className="text-[15px] font-medium leading-snug mb-3"
          style={{
            color: C.creamMid,
            fontStyle: 'normal',
            letterSpacing: '0.005em',
          }}
        >
          {tripRead}
        </p>

        {/* Route label */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-widest font-medium"
            style={{ color: C.creamMuted }}
          >
            Route
          </span>
          <span
            className="text-[13px] font-semibold"
            style={{ color: C.creamMid, fontFamily: "'DM Mono', 'Courier New', monospace" }}
          >
            {routeLabel}
          </span>
        </div>
      </div>

      {/* ── Divider ────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: C.divider, margin: '0 24px' }} />

      {/* ── Bottom section: metrics + health ──────────────────────── */}
      <div className="px-6 py-4">
        {/* Core metrics — compact, secondary, not the hero */}
        <div className="grid grid-cols-3 gap-2 mb-4 sm:grid-cols-5">
          <MetricPill label="Drive time" value={metrics.driveTime} />
          <MetricPill label="Distance"   value={metrics.distance} />
          <MetricPill label="Nights"     value={metrics.nights} />
          <MetricPill label="Rooms"      value={metrics.rooms} />
          <MetricPill label="Mode"       value={metrics.mode} />
          {metrics.drivers !== undefined && (
            <MetricPill label="Drivers" value={metrics.drivers} />
          )}
        </div>

        {/* Health phrase chip — supporting, not alarming */}
        <HealthChip phrase={healthPhrase} />
      </div>
    </div>
  );
}

/**
 * SketchCard — Beat 2: "Let MEE sketch this out"
 *
 * A compact glass card floating over the full-screen map.
 * Shows haversine-estimated distance, days from dates, and rough cost
 * from generateEstimate(). No API calls — pure math.
 *
 * Three exits:
 *   "Make it personal →"       → Beat 3 (Workshop)
 *   "Calculate with defaults →" → Skip to Beat 4 (orchestrateTrip)
 *   "Looks wrong? Adjust route →" → Classic wizard Step 1
 *
 * Desktop: centered float. Mobile: bottom sheet.
 *
 * 💚 My Experience Engine — Beat 2 of the Four-Beat Arc
 */

import type { SketchData } from '../../hooks/useFourBeatArc';
import { buildSketchFramingLine } from '../../lib/mode-voice';
import type { TripMode } from '../../types';

interface SketchCardProps {
  sketchData: SketchData;
  tripMode: TripMode;
  onMakePersonal: () => void;
  onCalculateDefaults: () => void;
  onAdjustRoute: () => void;
}

export function SketchCard({
  sketchData,
  tripMode,
  onMakePersonal,
  onCalculateDefaults,
  onAdjustRoute,
}: SketchCardProps) {
  const { distanceKm, days, estimate, originName, destinationName } = sketchData;
  const framingLine = buildSketchFramingLine(tripMode);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {/* Full-screen dark wash — same treatment as wizard and icebreaker */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(14, 11, 7, 0.72)', pointerEvents: 'none' }} />

      {/* Mobile: bottom sheet, Desktop: content floats on wash */}
      <div
        className="sketch-card"
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: '560px',
          padding: 'clamp(20px, 4vw, 32px)',
          animation: 'sketchCardIn 400ms ease forwards',
          position: 'relative',
        }}
      >
        <style>{`
          @keyframes sketchCardIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 640px) {
            .sketch-card {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              max-width: 100% !important;
              border-radius: 20px 20px 0 0 !important;
              background: rgba(13, 13, 16, 0.95) !important;
              border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            }
          }
        `}</style>

        {/* Header */}
        <p style={{
          color: 'rgba(245, 240, 232, 0.45)',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}>
          Let MEE sketch this out
        </p>

        {/* Route label */}
        <h2 style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 'clamp(20px, 3.5vw, 28px)',
          fontWeight: 600,
          color: '#f5f0e8',
          lineHeight: 1.2,
          margin: '0 0 12px',
        }}>
          {originName} → {destinationName}
        </h2>

        {/* Key numbers */}
        <p style={{
          color: 'rgba(245, 240, 232, 0.75)',
          fontSize: '16px',
          margin: '0 0 8px',
          fontVariantNumeric: 'tabular-nums',
        }}>
          ~{distanceKm.toLocaleString()} km{'  ·  '}
          {days} day{days !== 1 ? 's' : ''}{'  ·  '}
          ~{estimate.currency}{estimate.totalMid.toLocaleString()}
        </p>

        {/* Framing line */}
        <p style={{
          color: 'rgba(245, 240, 232, 0.4)',
          fontSize: '13px',
          margin: '0 0 24px',
          lineHeight: 1.4,
        }}>
          {framingLine}
        </p>

        {/* Primary CTA */}
        <button
          onClick={onMakePersonal}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: 'rgba(234, 88, 12, 0.85)',
            border: 'none',
            borderRadius: '12px',
            color: '#f5f0e8',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          Make it personal →
        </button>

        {/* Secondary: skip to calculate */}
        <button
          onClick={onCalculateDefaults}
          style={{
            width: '100%',
            padding: '10px 20px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: 'rgba(245, 240, 232, 0.65)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          Calculate with defaults →
        </button>

        {/* Escape hatch */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onAdjustRoute}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 240, 232, 0.3)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Looks wrong? Adjust route →
          </button>
        </div>
      </div>
    </div>
  );
}

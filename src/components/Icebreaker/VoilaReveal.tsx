/**
 * VoilaReveal — Beat 4: "Here's your MEE time"
 *
 * Full-screen reveal moment after orchestrateTrip completes.
 * Shows the destination, key numbers, and MEE's voice — then auto-dismisses.
 *
 * Desktop: 1.5s hold. Mobile: 0.8s hold. Tap anywhere to skip.
 * On dismiss, the wizard sidebar slides in with Step 3.
 *
 * 💚 My Experience Engine — Beat 4 of the Four-Beat Arc
 */

import { useEffect, useRef } from 'react';
import type { TripSummary, TripSettings } from '../../types';
import { formatHoursFromMinutes } from '../../lib/utils';

interface VoilaRevealProps {
  summary: TripSummary;
  settings: TripSettings;
  originName: string;
  destinationName: string;
  onComplete: () => void;
  /** Override hold time in ms from the reveal weight system. Falls back to desktop/mobile defaults. */
  holdMs?: number;
}

/** Hold time before auto-dismiss (ms). */
const HOLD_DESKTOP = 1500;
const HOLD_MOBILE = 800;

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 640;
}

export function VoilaReveal({
  summary,
  settings,
  originName,
  destinationName,
  onComplete,
  holdMs,
}: VoilaRevealProps) {
  const dismissed = useRef(false);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onComplete();
  };

  // Auto-dismiss after hold — reveal-weight holdMs takes priority over device defaults.
  useEffect(() => {
    const hold = holdMs ?? (isMobileViewport() ? HOLD_MOBILE : HOLD_DESKTOP);
    const id = setTimeout(dismiss, hold);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = summary.drivingDays;
  const driveLabel = formatHoursFromMinutes(Math.round(summary.totalDurationMinutes));
  const distanceKm = Math.round(summary.totalDistanceKm).toLocaleString();
  const currencySymbol = settings.currency === 'USD' ? '$' : 'C$';
  const cost = summary.costBreakdown
    ? Math.round(summary.costBreakdown.total)
    : null;

  const origin = originName.split(',')[0].trim();
  const dest = destinationName.split(',')[0].trim();

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(13, 13, 16, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        animation: 'voilaFadeIn 300ms ease forwards',
      }}
    >
      <style>{`
        @keyframes voilaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes voilaCardIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Card bloom */}
      <div style={{
        maxWidth: 400,
        width: '90%',
        padding: 'clamp(24px, 5vw, 36px)',
        background: 'rgba(13, 13, 16, 0.9)',
        border: '1px solid rgba(245, 240, 232, 0.08)',
        borderRadius: 20,
        textAlign: 'center',
        animation: 'voilaCardIn 400ms ease 100ms forwards',
        opacity: 0,
      }}>
        {/* Route */}
        <p style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 600,
          color: '#f5f0e8',
          lineHeight: 1.2,
          margin: '0 0 12px',
        }}>
          {origin} → {dest}
        </p>

        {/* Key metrics */}
        <p style={{
          color: 'rgba(245, 240, 232, 0.55)',
          fontSize: 14,
          fontVariantNumeric: 'tabular-nums',
          margin: '0 0 6px',
        }}>
          {distanceKm} km{'  ·  '}{days} day{days !== 1 ? 's' : ''}{'  ·  '}{driveLabel} driving
          {cost ? `  ·  ~${currencySymbol}${cost.toLocaleString()}` : ''}
        </p>
      </div>

      {/* MEE's voice */}
      <p style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(16px, 3vw, 22px)',
        fontStyle: 'italic',
        color: 'rgba(245, 240, 232, 0.7)',
        marginTop: 24,
        animation: 'voilaFadeIn 500ms ease 350ms forwards',
        opacity: 0,
      }}>
        Here&apos;s your MEE time.
      </p>

      {/* Hint */}
      <p style={{
        color: 'rgba(245, 240, 232, 0.2)',
        fontSize: 11,
        marginTop: 12,
        animation: 'voilaFadeIn 400ms ease 600ms forwards',
        opacity: 0,
      }}>
        Tap anywhere to continue
      </p>
    </div>
  );
}

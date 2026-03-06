/**
 * CarTrack — Unified journey progress component.
 *
 * Two modes:
 *  - 'wizard': 3 stops = Route · Vehicle · Results, car advances per step.
 *  - 'trip':   3 visible stops from paginated waypoints, car driven by
 *              ghost car progressPct (0–100 within the current window).
 *
 * The same car that drives Route→Vehicle→Results during planning becomes
 * the live trip tracker once the trip is confirmed. Zero new layout real estate.
 *
 * 💚 My Experience Engine
 */

import { useEffect, useRef, useState } from 'react';
import type { PlanningStep } from '../../hooks/useWizard';

// ── Types ───────────────────────────────────────────────────────────────────

interface CarTrackWizardProps {
  mode: 'wizard';
  currentStep: PlanningStep;
  completedSteps: number[];
  isCalculating?: boolean;
  onStepClick?: (step: PlanningStep) => void;
  canNavigateTo?: (step: number) => boolean;
}

interface CarTrackTripProps {
  mode: 'trip';
  /** Names of exactly 3 visible stops: [prev-or-origin, current, next] */
  windowStops: [string, string, string];
  /** 0–100, position of ghost car within the current 3-stop window */
  progressPct: number;
  /** True while the trip hasn't started yet (before departure time) */
  pending?: boolean;
}

type CarTrackProps = CarTrackWizardProps | CarTrackTripProps;

// ── Wizard stop config ───────────────────────────────────────────────────────

const WIZARD_STOPS: { number: PlanningStep; label: string }[] = [
  { number: 1, label: 'Route'   },
  { number: 2, label: 'Vehicle' },
  { number: 3, label: 'Results' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Center-X percentage for stop i in an n-stop equal-flex track. */
function stopPct(i: number, n: number): number {
  return 100 / (2 * n) + i * (100 / n);
}

/** Clamp a number between min and max. */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ── Component ────────────────────────────────────────────────────────────────

export function CarTrack(props: CarTrackProps) {
  const n = 3;

  // ── Wizard mode state ──
  const isWizard = props.mode === 'wizard';
  const currentStep  = isWizard ? (props as CarTrackWizardProps).currentStep  : 3;
  const completedSteps = isWizard ? (props as CarTrackWizardProps).completedSteps : [1, 2, 3];
  const isCalculating  = isWizard ? (props as CarTrackWizardProps).isCalculating ?? false : false;
  const onStepClick    = isWizard ? (props as CarTrackWizardProps).onStepClick   : undefined;
  const canNavigateTo  = isWizard ? (props as CarTrackWizardProps).canNavigateTo : undefined;

  // ── Trip mode state ──
  const windowStops  = !isWizard ? (props as CarTrackTripProps).windowStops : null;
  const rawProgress  = !isWizard ? (props as CarTrackTripProps).progressPct : 0;
  const pending      = !isWizard ? (props as CarTrackTripProps).pending ?? false : false;

  // ── Car target position ──
  const targetPct = isWizard
    ? stopPct(currentStep - 1, n)
    : clamp(
        stopPct(0, n) + (rawProgress / 100) * (stopPct(n - 1, n) - stopPct(0, n)),
        stopPct(0, n),
        stopPct(n - 1, n),
      );

  // Animate car smoothly — track the displayed position so we can transition.
  const displayPct = targetPct;

  // ── Window slide animation (trip mode pagination) ──
  const [sliding, setSliding] = useState(false);
  const prevWindowRef = useRef(windowStops ? windowStops[0] : '');

  useEffect(() => {
    if (windowStops && windowStops[0] !== prevWindowRef.current) {
      prevWindowRef.current = windowStops[0];
      setSliding(true);
    }
  }, [windowStops]);

  useEffect(() => {
    if (sliding) {
      const id = setTimeout(() => setSliding(false), 500);
      return () => clearTimeout(id);
    }
  }, [sliding]);

  // ── Arrival bounce (car just reached a stop) ──
  const [arrived, setArrived] = useState(false);
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (isWizard && currentStep !== prevStepRef.current) {
      prevStepRef.current = currentStep;
      setArrived(true);
    }
  }, [isWizard, currentStep]);

  useEffect(() => {
    if (arrived) {
      const id = setTimeout(() => setArrived(false), 700);
      return () => clearTimeout(id);
    }
  }, [arrived]);

  // ── Render ───────────────────────────────────────────────────────────────

  const stops = isWizard
    ? WIZARD_STOPS.map(s => s.label)
    : (windowStops as [string, string, string]);

  return (
    <div
      className={`car-track-root${sliding ? ' car-track-sliding' : ''}`}
      role="progressbar"
      aria-valuenow={isWizard ? currentStep : Math.round(rawProgress)}
      aria-valuemin={1}
      aria-valuemax={isWizard ? 3 : 100}
    >
      {/* ── Track rail ── */}
      <div className="car-track-rail">
        {/* Background rail */}
        <div className="car-track-rail-bg" />

        {/* Filled progress */}
        <div
          className="car-track-rail-fill"
          style={{ width: `${displayPct}%` }}
        />

        {/* Stop dots */}
        {stops.map((label, i) => {
          const pct = stopPct(i, n);
          const isDone = isWizard
            ? completedSteps.includes(i + 1)
            : i === 0; // first visible stop is always "passed" in trip mode
          const isActive = isWizard
            ? currentStep === i + 1
            : Math.abs(displayPct - pct) < 10 && !pending;
          const isClickable = isWizard && canNavigateTo?.(i + 1) && !isCalculating;

          return (
            <button
              key={label}
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.((i + 1) as PlanningStep)}
              className={[
                'car-track-stop',
                isDone    ? 'done'    : '',
                isActive  ? 'active'  : '',
                isClickable ? 'clickable' : '',
              ].filter(Boolean).join(' ')}
              style={{ left: `${pct}%` }}
              aria-label={isWizard ? `Go to step ${i + 1}: ${label}` : label}
            >
              <div className="car-track-dot" />
              <span className="car-track-label">{label}</span>
            </button>
          );
        })}

        {/* The car 🚗 */}
        <div
          className={[
            'car-track-car',
            isCalculating ? 'calculating' : '',
            arrived       ? 'arrived'     : '',
            pending       ? 'pending'     : '',
          ].filter(Boolean).join(' ')}
          style={{
            left: `${displayPct}%`,
            transition: isCalculating ? 'none' : 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-hidden="true"
        >
          🚗
        </div>
      </div>

      {/* ── Calculating status text ── */}
      {isCalculating && (
        <p className="car-track-status">Plotting your MEE time…</p>
      )}
      {pending && (
        <p className="car-track-status">Trip not started yet</p>
      )}
    </div>
  );
}

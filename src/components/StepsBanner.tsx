/**
 * StepsBanner — Panel header with branding, mode badge, rotating tagline,
 * and pill-style step indicators.
 *
 * Two rows:
 *   1. "My Experience Engine" (Cormorant Garamond) + rotating tagline
 *      + mode badge dropdown
 *   2. Pill dot step indicators (Route · Vehicle · Results)
 */

import { useState, useEffect } from 'react';
import type { TripMode } from '../types';
import type { PlanningStep } from '../hooks/useWizard';

// ── Taglines ────────────────────────────────────────────────────────────────

const TAGLINES = [
  'Your MEE time is out there.',
  'Every road leads somewhere worth going.',
  'The drive is part of the story.',
  'Some trips change you.',
];

// ── Step config ────────────────────────────────────────────────────────────

const STEP_CONFIG = [
  { number: 1 as const, title: 'Route'   },
  { number: 2 as const, title: 'Vehicle' },
  { number: 3 as const, title: 'Results' },
];

// ── Mode config ────────────────────────────────────────────────────────────

const MODE_CONFIG = {
  plan:      { icon: '📋', label: 'Plan',      desc: 'Design My MEE Time', color: '#22C55E', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)'   },
  estimate:  { icon: '💰', label: 'Estimate',  desc: 'Price My MEE Time',  color: '#93C5FD', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.3)'  },
  adventure: { icon: '🧭', label: 'Adventure', desc: 'Find My MEE Time',   color: '#FDE68A', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
} as const;

// ── Props ──────────────────────────────────────────────────────────────────

interface StepsBannerProps {
  currentStep: PlanningStep;
  completedSteps: number[];
  tripMode: TripMode;
  isCalculating?: boolean;
  onStepClick: (step: PlanningStep) => void;
  showModeSwitcher: boolean;
  setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  modeSwitcherRef: React.RefObject<HTMLDivElement | null>;
  onSwitchMode: (mode: TripMode) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function StepsBanner({
  currentStep,
  completedSteps,
  tripMode,
  isCalculating,
  onStepClick,
  showModeSwitcher,
  setShowModeSwitcher,
  modeSwitcherRef,
  onSwitchMode,
}: StepsBannerProps) {
  const mode = MODE_CONFIG[tripMode];

  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTaglineIndex(prev => (prev + 1) % TAGLINES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const canNavigateTo = (stepNumber: number) =>
    stepNumber <= currentStep || completedSteps.includes(stepNumber - 1);

  return (
    <div className="w-full shrink-0 px-4 pt-4 pb-3 border-b border-white/5">

      {/* ── Row 1: Brand + Mode Badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="mee-brand-title">My Experience Engine</h1>
          <p className="mee-brand-sub">Road trips worth remembering</p>
          <div className="mee-tagline">
            <span key={taglineIndex} className="mee-tagline-inner">
              {TAGLINES[taglineIndex]}
            </span>
          </div>
        </div>

        {/* Mode badge */}
        <div className="relative flex-shrink-0" ref={modeSwitcherRef}>
          <button
            onClick={() => setShowModeSwitcher(prev => !prev)}
            className="mode-badge text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full whitespace-nowrap cursor-pointer transition-all hover:brightness-125"
            style={{
              fontFamily: "'DM Mono', monospace",
              background: mode.bg,
              color: mode.color,
              border: `1px solid ${mode.border}`,
            }}
            aria-label="Switch trip mode"
          >
            {mode.icon} {mode.label}
            <span className="ml-1 opacity-50">▾</span>
          </button>

          {showModeSwitcher && (
            <div className="mode-switcher-dropdown">
              {(Object.entries(MODE_CONFIG) as [TripMode, typeof MODE_CONFIG[TripMode]][]).map(
                ([modeKey, cfg]) => (
                  <button
                    key={modeKey}
                    disabled={modeKey === tripMode}
                    onClick={() => { setShowModeSwitcher(false); onSwitchMode(modeKey); }}
                    className="mode-switcher-option"
                    style={{
                      '--mode-color': cfg.color,
                      '--mode-bg':    cfg.bg,
                      opacity: modeKey === tripMode ? 0.5 : 1,
                    } as React.CSSProperties}
                  >
                    <span className="text-base">{cfg.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground">{cfg.desc}</div>
                    </div>
                    {modeKey === tripMode && (
                      <span className="text-[9px] tracking-wider uppercase" style={{ color: cfg.color }}>
                        Current
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Pill Step Dots ── */}
      <div className="flex items-center gap-2 mt-4">
        {STEP_CONFIG.map((step, index) => {
          const isActive    = step.number === currentStep;
          const isCompleted = completedSteps.includes(step.number);
          const isClickable = canNavigateTo(step.number) && !isCalculating;

          const dotClass = [
            'mee-step-dot',
            isActive ? 'active' : '',
            isCompleted && !isActive ? 'done' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={step.number} className="flex items-center gap-2">
              <button
                onClick={() => isClickable && onStepClick(step.number)}
                disabled={!isClickable}
                className="flex items-center gap-1.5"
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                <div className={dotClass} />
                <span className={`mee-step-label ${isActive ? 'active' : ''}`}>
                  {step.title}
                </span>
              </button>

              {index < STEP_CONFIG.length - 1 && (
                <div style={{
                  width: 20,
                  height: 1,
                  background: 'rgba(245,240,232,0.1)',
                  flexShrink: 0,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

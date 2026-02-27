/**
 * StepsBanner — Full app header with branding, mode badge, and step indicator.
 *
 * Two rows:
 *   1. "My Experience Engine" title + clickable mode badge (with switcher dropdown)
 *   2. Route → Vehicle → Results step indicators (clickable)
 *
 * Spans full page width on both portrait and desktop.
 */

import { Check, MapPin, Car, Map, Loader2 } from 'lucide-react';
import type { TripMode } from '../types';
import type { PlanningStep } from '../hooks/useWizard';

// ── Step config ────────────────────────────────────────────────────────────────

const STEP_CONFIG = [
  { number: 1 as const, title: 'Route',   description: 'Where & When', icon: MapPin },
  { number: 2 as const, title: 'Vehicle', description: 'Who & How',    icon: Car   },
  { number: 3 as const, title: 'Results', description: 'Your Trip',    icon: Map   },
];

// ── Mode config (mirrors old Sidebar) ─────────────────────────────────────────

const MODE_CONFIG = {
  plan:      { icon: '📋', label: 'Plan',      desc: 'Design My MEE Time', color: '#22C55E', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)'   },
  estimate:  { icon: '💰', label: 'Estimate',  desc: 'Price My MEE Time',  color: '#93C5FD', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.3)'  },
  adventure: { icon: '🧭', label: 'Adventure', desc: 'Find My MEE Time',   color: '#FDE68A', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
} as const;

// ── Props ──────────────────────────────────────────────────────────────────────

interface StepsBannerProps {
  currentStep: PlanningStep;
  completedSteps: number[];
  tripMode: TripMode;
  isCalculating?: boolean;
  onStepClick: (step: PlanningStep) => void;
  // Mode switcher
  showModeSwitcher: boolean;
  setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  modeSwitcherRef: React.RefObject<HTMLDivElement | null>;
  onSwitchMode: (mode: TripMode) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

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

  const canNavigateTo = (stepNumber: number) =>
    stepNumber <= currentStep || completedSteps.includes(stepNumber - 1);

  return (
    <div
      className="w-full shrink-0 sidebar-header"
      style={{ background: 'hsl(225 30% 8%)' }}
    >
      {/* ── Row 1: Branding + Mode Badge ── */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
        <h1 className="sidebar-brand-title">My Experience Engine</h1>

        {/* Mode badge — click to open switcher */}
        <div className="relative" ref={modeSwitcherRef}>
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

      <p className="sidebar-brand-sub px-4 pb-2">Road trips worth remembering</p>

      {/* ── Row 2: Step Indicator ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between w-full">
          {STEP_CONFIG.map((step, index) => {
            const Icon = step.icon;
            const isActive    = step.number === currentStep;
            const isCompleted = completedSteps.includes(step.number);
            const isClickable = canNavigateTo(step.number) && !isCalculating;
            const isLoading   = isCalculating && step.number === 3 && currentStep === 2;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <button
                  onClick={() => isClickable && onStepClick(step.number)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 group transition-all ${
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {/* Circle */}
                  <div
                    className={`step-circle relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      isCompleted ? 'is-completed' : isActive ? 'is-active' : ''
                    } ${isClickable && !isActive ? 'group-hover:border-primary group-hover:text-primary' : ''}`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping opacity-20"
                        style={{ background: 'hsl(36 96% 56%)' }}
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="hidden sm:block text-left">
                    <div className={`step-title text-sm font-semibold transition-colors ${
                      isActive ? 'is-active' : isCompleted ? 'is-completed' : ''
                    }`}>
                      {step.title}
                    </div>
                    <div className="step-desc">{step.description}</div>
                  </div>
                </button>

                {/* Connector */}
                {index < STEP_CONFIG.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-4">
                    <div className={`step-connector h-0.5 rounded-full transition-all duration-500 ${
                      isCompleted ? 'is-completed' : isActive ? 'is-active' : ''
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

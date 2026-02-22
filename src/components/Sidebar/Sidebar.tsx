import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../UI/Button';
import { Card, CardContent } from '../UI/Card';
import { StepIndicator } from '../UI/StepIndicator';
import { Spinner } from '../UI/Spinner';
import type { TripMode, MarkerCategory, POICategory } from '../../types';
import type { PlanningStep } from '../../hooks/useWizard';

interface SidebarProps {
  // Navigation
  planningStep: PlanningStep;
  completedSteps: number[];
  canProceedFromStep1: boolean;
  canProceedFromStep2: boolean;
  isCalculating: boolean;
  onStepClick: (step: PlanningStep) => void;
  onNext: () => void;
  onBack: () => void;
  onReset: () => void;

  // Mode
  tripMode: TripMode;
  showModeSwitcher: boolean;
  setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  modeSwitcherRef: React.RefObject<HTMLDivElement>;
  onSwitchMode: (mode: TripMode) => void;

  // POI bar
  markerCategories: MarkerCategory[];
  loadingCategory: string | null;
  onToggleCategory: (id: POICategory) => void;

  // Error
  error: string | null;
  onClearError: () => void;

  // DOM
  sidebarScrollRef: React.RefObject<HTMLDivElement>;

  // Step content (pre-composed by App)
  children: React.ReactNode;
}

const MODE_CONFIG = {
  plan:      { icon: '📋', label: 'Plan',      desc: 'Design My MEE Time', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)',  border: 'rgba(34, 197, 94, 0.3)',  btnBg: 'rgba(34, 197, 94, 0.1)'  },
  estimate:  { icon: '💰', label: 'Estimate',  desc: 'Price My MEE Time',  color: '#93C5FD', bg: 'rgba(59, 130, 246, 0.15)',  border: 'rgba(59, 130, 246, 0.3)',  btnBg: 'rgba(59, 130, 246, 0.1)'  },
  adventure: { icon: '🧭', label: 'Adventure', desc: 'Find My MEE Time',   color: '#FDE68A', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', btnBg: 'rgba(245, 158, 11, 0.1)' },
} as const;

function getNextLabel(tripMode: TripMode, isCalculating: boolean): React.ReactNode {
  if (isCalculating) {
    return <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Calculating...</>;
  }
  const labels: Record<TripMode, string> = {
    estimate:  'Price My MEE Time',
    adventure: 'Find My MEE Time',
    plan:      'Design My MEE Time',
  };
  return <>{labels[tripMode]} <ChevronRight className="h-4 w-4 ml-1" /></>;
}

export function Sidebar({
  planningStep,
  completedSteps,
  canProceedFromStep1,
  canProceedFromStep2,
  isCalculating,
  onStepClick,
  onNext,
  onBack,
  onReset,
  tripMode,
  showModeSwitcher,
  setShowModeSwitcher,
  modeSwitcherRef,
  onSwitchMode,
  markerCategories,
  loadingCategory,
  onToggleCategory,
  error,
  onClearError,
  sidebarScrollRef,
  children,
}: SidebarProps) {
  const mode = MODE_CONFIG[tripMode];
  const canProceed = planningStep === 1 ? canProceedFromStep1 : canProceedFromStep2;

  return (
    <div
      className="sidebar-dark sidebar-entrance w-full md:w-[420px] md:h-full flex flex-col z-10 shadow-2xl order-2 md:order-1 hidden md:flex"
      style={{ background: 'hsl(225 30% 8%)' }}
    >
      {/* Header */}
      <div className="sidebar-header p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2.5">
            <h1 className="sidebar-brand-title">My Experience Engine</h1>

            {/* Mode badge — click to switch */}
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
                {MODE_CONFIG[tripMode].icon} {MODE_CONFIG[tripMode].label}
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
                          '--mode-bg': cfg.btnBg,
                          opacity: modeKey === tripMode ? 0.5 : 1,
                        } as React.CSSProperties}
                      >
                        <span className="text-base">{cfg.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="text-xs font-bold" style={{ color: cfg.color }}>
                            {cfg.label}
                          </div>
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
          <p className="sidebar-brand-sub">Road trips worth remembering</p>
        </div>
        <StepIndicator
          currentStep={planningStep}
          onStepClick={onStepClick}
          completedSteps={completedSteps}
        />
      </div>

      {/* POI Controls (Step 3 only) */}
      {planningStep === 3 && (
        <div className="poi-bar px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar items-center">
          {markerCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => !loadingCategory && onToggleCategory(cat.id)}
              disabled={!!loadingCategory}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                cat.visible
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              } ${loadingCategory && loadingCategory !== cat.id ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loadingCategory === cat.id ? (
                <Spinner size={12} className="text-current" />
              ) : (
                <span>{cat.emoji}</span>
              )}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-2">
          <span className="font-bold">Error:</span> {error}
          <button onClick={onClearError} className="ml-auto font-bold">×</button>
        </div>
      )}

      {/* Step Content */}
      <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4">
        <Card className="border-0 shadow-none">
          <CardContent className="px-0 pt-0">{children}</CardContent>
        </Card>
      </div>

      {/* Navigation Footer */}
      <div className="sidebar-nav-footer p-4">
        <div className="flex gap-2">
          {planningStep > 1 && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {planningStep < 3 && (
            <Button
              onClick={onNext}
              disabled={!canProceed || isCalculating}
              className="flex-1"
            >
              {planningStep === 2 ? getNextLabel(tripMode, isCalculating) : <>Next <ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
          )}
          {planningStep === 3 && (
            <Button onClick={onReset} variant="outline" className="flex-1">
              Plan New Trip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

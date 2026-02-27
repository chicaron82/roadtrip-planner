/**
 * StepsBanner — Prominent clickable step indicator for unified layout.
 *
 * Displays the current step prominently with clickable navigation to
 * completed steps. Works identically on both portrait and landscape.
 */

import { Check, MapPin, Car, Map, Loader2 } from 'lucide-react';
import type { TripMode } from '../types';
import type { PlanningStep } from '../hooks/useWizard';

const STEP_CONFIG = [
  { number: 1 as const, title: 'Locations', shortTitle: 'Where', icon: MapPin },
  { number: 2 as const, title: 'Travelers', shortTitle: 'Who', icon: Car },
  { number: 3 as const, title: 'Trip', shortTitle: 'Go', icon: Map },
];

const MODE_COLORS: Record<TripMode, { accent: string; bg: string }> = {
  plan:      { accent: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' },
  estimate:  { accent: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  adventure: { accent: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
};

interface StepsBannerProps {
  currentStep: PlanningStep;
  completedSteps: number[];
  tripMode: TripMode;
  isCalculating?: boolean;
  onStepClick: (step: PlanningStep) => void;
}

export function StepsBanner({
  currentStep,
  completedSteps,
  tripMode,
  isCalculating,
  onStepClick,
}: StepsBannerProps) {
  const { accent, bg } = MODE_COLORS[tripMode];

  const canNavigateTo = (stepNumber: number) => {
    return stepNumber <= currentStep || completedSteps.includes(stepNumber - 1);
  };

  return (
    <div
      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 shrink-0"
      style={{ background: 'hsl(225 30% 10%)' }}
    >
      {STEP_CONFIG.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.number === currentStep;
        const isCompleted = completedSteps.includes(step.number);
        const isClickable = canNavigateTo(step.number) && !isCalculating;
        const isLoading = isCalculating && step.number === 3 && currentStep === 2;

        return (
          <div key={step.number} className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all w-full min-w-0
                ${isClickable ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-50'}
                ${isActive ? 'bg-white/10' : ''}
              `}
              style={isActive ? { borderLeft: `3px solid ${accent}` } : undefined}
            >
              {/* Icon circle */}
              <div
                className={`
                  relative flex items-center justify-center w-8 h-8 rounded-full shrink-0
                  border-2 transition-all
                  ${isCompleted ? 'border-green-500 bg-green-500/20 text-green-400' : ''}
                  ${isActive && !isCompleted ? 'border-current' : ''}
                  ${!isActive && !isCompleted ? 'border-gray-600 text-gray-500' : ''}
                `}
                style={isActive && !isCompleted ? { borderColor: accent, color: accent, background: bg } : undefined}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>

              {/* Text */}
              <div className="text-left min-w-0 hidden sm:block">
                <div
                  className={`text-sm font-semibold truncate ${
                    isActive ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </div>
              </div>
              {/* Short title for mobile */}
              <span
                className={`text-xs font-medium sm:hidden ${
                  isActive ? 'text-white' : isCompleted ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {step.shortTitle}
              </span>
            </button>

            {/* Connector line */}
            {index < STEP_CONFIG.length - 1 && (
              <div className="w-4 sm:w-8 h-0.5 bg-gray-700 mx-1 shrink-0">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: isCompleted ? '100%' : '0%',
                    background: accent,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

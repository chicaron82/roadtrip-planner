/**
 * WizardContent — Unified form container for all wizard steps.
 *
 * Displays step content with:
 * - Error banner (if any)
 * - POI category bar (step 3 only)
 * - Scrollable content area
 * - Navigation footer (Back / Next / Plan New Trip)
 *
 * Consumes PlannerContext — no external props required.
 */

import { useRef, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { TripMode } from '../types';
import { usePlanner } from '../contexts';

const MODE_LABELS: Record<TripMode, string> = {
  estimate:  'Price My MEE Time',
  adventure: 'Find My MEE Time',
  plan:      'Design My MEE Time',
};

interface WizardContentProps {
  children: ReactNode;
}

export function WizardContent({ children }: WizardContentProps) {
  const {
    planningStep, canProceed, isCalculating,
    onNext, onBack, onReset,
    tripMode,
    error, onClearError,
    calculationMessage,
  } = usePlanner();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [planningStep]);

  return (
    <div className="flex flex-col flex-1 min-h-0 text-foreground">
      {/* Error Banner */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-center gap-2 shrink-0">
          <span className="font-bold">Error:</span> {error}
          <button onClick={onClearError} className="ml-auto font-bold">×</button>
        </div>
      )}

      {/* Scrollable Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </div>

      {/* Navigation Footer */}
      <div className="sidebar-nav-footer p-3 shrink-0">
        <div className="flex gap-2">
          {planningStep > 1 && (
            <button className="mee-outline-button flex-1" onClick={onBack}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          {planningStep < 3 && (
            <button
              className={`mee-cta-button flex-1${canProceed && !isCalculating ? ' ready' : ''}`}
              onClick={onNext}
              disabled={!canProceed || isCalculating}
            >
              {isCalculating ? (
                <><Loader2 size={14} className="animate-spin" /> {calculationMessage ?? 'Calculating…'}</>
              ) : planningStep === 2 ? (
                <>{MODE_LABELS[tripMode]} <ChevronRight size={14} /></>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </button>
          )}
          {planningStep === 3 && (
            <button className="mee-outline-button flex-1" onClick={onReset}>
              Plan New Trip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * WizardContent — Unified form container for all wizard steps.
 *
 * Displays step content with:
 * - Error banner (if any)
 * - POI category bar (step 3 only)
 * - Scrollable content area
 * - Navigation footer (Back / Next / Plan New Trip)
 */

import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from './UI/Button';
import { Spinner } from './UI/Spinner';
import type { TripMode, MarkerCategory, POICategory } from '../types';
import type { PlanningStep } from '../hooks/useWizard';

const MODE_LABELS: Record<TripMode, string> = {
  estimate:  'Price My MEE Time',
  adventure: 'Find My MEE Time',
  plan:      'Design My MEE Time',
};

interface WizardContentProps {
  // Navigation
  planningStep: PlanningStep;
  canProceed: boolean;
  isCalculating: boolean;
  onNext: () => void;
  onBack: () => void;
  onReset: () => void;

  // Mode
  tripMode: TripMode;

  // POI bar (step 3 only)
  markerCategories: MarkerCategory[];
  loadingCategory: string | null;
  onToggleCategory: (id: POICategory) => void;

  // Error
  error: string | null;
  onClearError: () => void;

  // Content
  children: React.ReactNode;
}

export function WizardContent({
  planningStep,
  canProceed,
  isCalculating,
  onNext,
  onBack,
  onReset,
  tripMode,
  markerCategories,
  loadingCategory,
  onToggleCategory,
  error,
  onClearError,
  children,
}: WizardContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [planningStep]);

  return (
    <div
      className="sidebar-dark flex flex-col flex-1 min-h-0 bg-background text-foreground"
    >
      {/* POI Category Bar (Step 3 only) */}
      {planningStep === 3 && (
        <div className="px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar items-center shrink-0 border-b border-white/5">
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
              {isCalculating ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Calculating...</>
              ) : planningStep === 2 ? (
                <>{MODE_LABELS[tripMode]} <ChevronRight className="h-4 w-4 ml-1" /></>
              ) : (
                <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
              )}
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

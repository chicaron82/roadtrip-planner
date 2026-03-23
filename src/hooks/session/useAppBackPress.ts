/**
 * useAppBackPress — Android hardware back-button logic for the MEE app.
 *
 * Extracted from App.tsx to keep the orchestrator within its 330-line budget.
 * Owns the priority stack: journal exit → icebreaker arc → wizard steps.
 * Internally calls useBackButtonGuard so the guard wiring stays co-located
 * with the handler that drives it.
 *
 * 💚 My Experience Engine
 */
import { useCallback } from 'react';
import type { TripMode } from '../../types';
import type { ViewMode } from '../journey/useJournal';
import type { TripJournal } from '../../types';
import type { PlanningStep } from '../wizard/useWizard';
import { useBackButtonGuard } from './useBackButtonGuard';

interface UseAppBackPressOptions {
  activeJournal: TripJournal | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  icebreaker: { arcActive: boolean; handleBack: () => void };
  tripMode: TripMode | null;
  planningStep: number;
  goToStep: (step: PlanningStep) => void;
}

export function useAppBackPress({
  activeJournal,
  viewMode,
  setViewMode,
  icebreaker,
  tripMode,
  planningStep,
  goToStep,
}: UseAppBackPressOptions): void {
  const handleBackPress = useCallback(() => {
    // 1. Journal active — exit to plan view
    if (activeJournal && viewMode === 'journal') { setViewMode('plan'); return; }
    // 2. Arc / icebreaker — delegate to orchestrator (it knows beat state)
    if (icebreaker.arcActive) { icebreaker.handleBack(); return; }
    // 3. Wizard steps
    if (tripMode && planningStep === 3) { goToStep(2); return; }
    if (tripMode && planningStep === 2) { goToStep(1); return; }
    // 4. Already at root — do nothing
  }, [activeJournal, viewMode, setViewMode, icebreaker, tripMode, planningStep, goToStep]);

  const backGuardActive = !!(tripMode || icebreaker.arcActive);
  useBackButtonGuard(backGuardActive, handleBackPress);
}

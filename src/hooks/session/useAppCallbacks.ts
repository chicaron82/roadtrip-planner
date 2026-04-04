/**
 * useAppCallbacks — Derived callbacks composed from multiple hooks.
 * Extracted from App.tsx to keep it under 300 lines per CLAUDE.md rules.
 * Follows the wiring decision tree: 5 handlers → dedicated hook.
 */
import { useCallback } from 'react';
import type { Location, TripMode } from '../../types';
import type { PlanningStep } from '../wizard/useWizard';

interface UseAppCallbacksParams {
  calcError: string | null;
  journalError: string | null;
  clearPOIError: () => void;
  clearCalcError: () => void;
  clearJournalError: () => void;
  triggerCopyShareLink: (url: string | null) => Promise<void>;
  shareUrl: string | null;
  locations: Location[];
  planningStep: PlanningStep;
  calculateAndDiscover: () => void;
  wizardNext: () => void;
  setTripMode: (mode: TripMode | null) => void;
}

export function useAppCallbacks({
  calcError, journalError, clearPOIError, clearCalcError, clearJournalError,
  triggerCopyShareLink, shareUrl,
  locations,
  planningStep, calculateAndDiscover, wizardNext,
  setTripMode,
}: UseAppCallbacksParams) {
  const error = calcError || journalError;

  const clearError = useCallback(
    () => { clearPOIError(); clearCalcError(); clearJournalError(); },
    [clearPOIError, clearCalcError, clearJournalError],
  );

  const copyShareLink = useCallback(
    () => triggerCopyShareLink(shareUrl),
    [triggerCopyShareLink, shareUrl],
  );

  const goToNextStep = useCallback(
    () => { if (planningStep === 2) calculateAndDiscover(); else wizardNext(); },
    [planningStep, calculateAndDiscover, wizardNext],
  );

  const handleResumeSession = useCallback(
    () => {
      setTripMode('plan');
      if (planningStep === 3 && locations.length >= 2) calculateAndDiscover();
    },
    [setTripMode, planningStep, locations.length, calculateAndDiscover],
  );

  return { error, clearError, copyShareLink, goToNextStep, handleResumeSession };
}

/**
 * useAppCallbacks — Derived callbacks composed from multiple hooks.
 * Extracted from App.tsx to keep it under 300 lines per CLAUDE.md rules.
 * Follows the wiring decision tree: 5 handlers → dedicated hook.
 */
import { useCallback } from 'react';
import type { Location, POICategory, TripMode } from '../types';
import type { PlanningStep } from './useWizard';

interface UseAppCallbacksParams {
  poiError: string | null;
  calcError: string | null;
  journalError: string | null;
  clearPOIError: () => void;
  clearCalcError: () => void;
  clearJournalError: () => void;
  triggerCopyShareLink: (url: string | null) => Promise<void>;
  shareUrl: string | null;
  locations: Location[];
  toggleCategory: (id: POICategory, loc: Location | null, geom?: [number, number][] | null) => void;
  validRouteGeometry: [number, number][] | null;
  planningStep: PlanningStep;
  calculateAndDiscover: () => void;
  wizardNext: () => void;
  setTripMode: (mode: TripMode | null) => void;
}

export function useAppCallbacks({
  poiError, calcError, journalError, clearPOIError, clearCalcError, clearJournalError,
  triggerCopyShareLink, shareUrl,
  locations, toggleCategory, validRouteGeometry,
  planningStep, calculateAndDiscover, wizardNext,
  setTripMode,
}: UseAppCallbacksParams) {
  const error = poiError || calcError || journalError;

  const clearError = useCallback(
    () => { clearPOIError(); clearCalcError(); clearJournalError(); },
    [clearPOIError, clearCalcError, clearJournalError],
  );

  const copyShareLink = useCallback(
    () => triggerCopyShareLink(shareUrl),
    [triggerCopyShareLink, shareUrl],
  );

  const handleToggleCategory = useCallback(
    (id: POICategory) => {
      const loc = locations.find(l => l.type === 'destination' && l.lat !== 0) || locations[0];
      toggleCategory(id, loc.lat !== 0 ? loc : null, validRouteGeometry);
    },
    [locations, toggleCategory, validRouteGeometry],
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

  return { error, clearError, copyShareLink, handleToggleCategory, goToNextStep, handleResumeSession };
}

/**
 * useAppTemplateHandlers — Template import actions for the MEETime preview screen.
 *
 * Extracted from App.tsx to keep the orchestrator within its 330-line budget.
 * Owns the two callbacks fired when a user acts on a pending MEETime template:
 *   - Build: import + dismiss + calculate (full trip load)
 *   - Open in Planner: import + dismiss without calculating (manual edit path)
 *
 * 💚 My Experience Engine
 */
import { useCallback } from 'react';
import type { TemplateImportResult } from '../../lib/url';
import type { TripMode } from '../../types';

interface UseAppTemplateHandlersOptions {
  handleImportTemplate: (r: TemplateImportResult) => void;
  handleDismissPendingTemplate: () => void;
  setTripMode: (mode: TripMode | null) => void;
  calculateAndDiscover: () => void;
}

export function useAppTemplateHandlers({
  handleImportTemplate,
  handleDismissPendingTemplate,
  setTripMode,
  calculateAndDiscover,
}: UseAppTemplateHandlersOptions) {
  const handleBuildFromTemplate = useCallback((modified: TemplateImportResult) => {
    handleImportTemplate(modified);
    handleDismissPendingTemplate();
    setTripMode('plan');
    calculateAndDiscover();
  }, [handleImportTemplate, handleDismissPendingTemplate, setTripMode, calculateAndDiscover]);

  const handleOpenPlannerFromTemplate = useCallback((modified: TemplateImportResult) => {
    handleImportTemplate(modified);
    handleDismissPendingTemplate();
    setTripMode('plan');
  }, [handleImportTemplate, handleDismissPendingTemplate, setTripMode]);

  return { handleBuildFromTemplate, handleOpenPlannerFromTemplate };
}

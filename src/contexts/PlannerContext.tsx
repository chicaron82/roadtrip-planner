/**
 * PlannerContext — Ephemeral orchestration state for the active planning session.
 *
 * Owns the shared state that was previously threaded as props through:
 *   App.tsx → PlannerFullscreenShell → WizardContent + StepsBanner
 *
 * This is NOT canonical trip data (that lives in TripContext/Zustand).
 * It is UI state: wizard steps, errors, POI categories, mode-switcher controls, etc.
 *
 * Lifecycle: mounted when `tripMode && !showVoila` (the planning shell is active),
 * unmounted when the user lands on the VoilaScreen or returns home.
 */

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode, type RefObject, type Dispatch, type SetStateAction } from 'react';
import type { TripMode } from '../types';
import type { PlanningStep } from '../hooks';
import type { GhostCarState } from '../hooks';

// ── Context Type ──────────────────────────────────────────────────────────────

export interface PlannerContextType {
  // Wizard step controls
  planningStep: PlanningStep;
  completedSteps: number[];
  canProceed: boolean;
  isCalculating: boolean;
  onStepClick: (step: PlanningStep) => void;
  onNext: () => void;
  onBack: () => void;
  onReset: () => void;

  // Trip mode and mode switcher
  tripMode: TripMode;
  showModeSwitcher: boolean;
  setShowModeSwitcher: Dispatch<SetStateAction<boolean>>;
  modeSwitcherRef: RefObject<HTMLDivElement | null>;
  onSwitchMode: (mode: TripMode) => void;
  onGoHome: (() => void) | null;

  // Ghost car (trip mode step 3)
  ghostCar: GhostCarState | null;

  // Error banner
  error: string | null;
  onClearError: () => void;

  // Progressive calculation status message
  calculationMessage?: string | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const PlannerContext = createContext<PlannerContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface PlannerProviderProps {
  value: PlannerContextType;
  children: ReactNode;
}

export function PlannerProvider({ value, children }: PlannerProviderProps) {
  return <PlannerContext value={value}>{children}</PlannerContext>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePlanner(): PlannerContextType {
  const ctx = useContext(PlannerContext);
  if (!ctx) {
    throw new Error('usePlanner() must be used inside <PlannerProvider>');
  }
  return ctx;
}

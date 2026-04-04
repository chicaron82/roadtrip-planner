/**
 * StepsBanner — component integration tests
 *
 * Verifies step-button enabled/disabled states, onStepClick wiring,
 * isCalculating guard, and mode badge fundamentals.
 *
 * Buttons delegate to CarTrack which uses aria-label="Go to step N: Label".
 * A button is disabled when canNavigateTo(N) returns false OR isCalculating.
 *
 * canNavigateTo(N) = N <= currentStep || completedSteps.includes(N - 1)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { StepsBanner } from './StepsBanner';
import { PlannerProvider, type PlannerContextType } from '../contexts/PlannerContext';
import type { PlanningStep } from '../hooks';
import type { TripMode } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SetupOptions {
  currentStep?: PlanningStep;
  completedSteps?: number[];
  tripMode?: TripMode;
  isCalculating?: boolean;
  showModeSwitcher?: boolean;
}

function setup(opts: SetupOptions = {}) {
  const onStepClick = vi.fn();
  const setShowModeSwitcher = vi.fn();
  const onSwitchMode = vi.fn();
  const modeSwitcherRef = createRef<HTMLDivElement>();

  const plannerValue: PlannerContextType = {
    planningStep: opts.currentStep ?? 1,
    completedSteps: opts.completedSteps ?? [],
    tripMode: opts.tripMode ?? 'plan',
    isCalculating: opts.isCalculating ?? false,
    canProceed: true,
    onStepClick,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onReset: vi.fn(),
    showModeSwitcher: opts.showModeSwitcher ?? false,
    setShowModeSwitcher,
    modeSwitcherRef,
    onSwitchMode,
    onGoHome: vi.fn(),
    ghostCar: null,
    error: null,
    onClearError: vi.fn(),
    calculationMessage: null,
  };

  render(
    <PlannerProvider value={plannerValue}>
      <StepsBanner />
    </PlannerProvider>,
  );

  const stepButton = (n: number) =>
    screen.getByRole('button', { name: new RegExp(`Go to step ${n}:`, 'i') });

  return { onStepClick, setShowModeSwitcher, onSwitchMode, stepButton };
}

// ─── Step navigation — enabled / disabled states ──────────────────────────────

describe('step button enabled/disabled states', () => {
  it('on step 1 with no completed steps: step 1 enabled, steps 2 and 3 disabled', () => {
    const { stepButton } = setup({ currentStep: 1, completedSteps: [] });
    expect(stepButton(1)).not.toBeDisabled();
    expect(stepButton(2)).toBeDisabled();
    expect(stepButton(3)).toBeDisabled();
  });

  it('on step 2 with completedSteps=[1]: steps 1 and 2 enabled, step 3 disabled', () => {
    const { stepButton } = setup({ currentStep: 2, completedSteps: [1] });
    expect(stepButton(1)).not.toBeDisabled();
    expect(stepButton(2)).not.toBeDisabled();
    expect(stepButton(3)).toBeDisabled();
  });

  it('on step 3 with completedSteps=[1,2]: all three steps enabled', () => {
    const { stepButton } = setup({ currentStep: 3, completedSteps: [1, 2] });
    expect(stepButton(1)).not.toBeDisabled();
    expect(stepButton(2)).not.toBeDisabled();
    expect(stepButton(3)).not.toBeDisabled();
  });

  it('step 2 stays disabled on step 1 even if completedSteps contains unrelated values', () => {
    // completedSteps=[0] — only includes step 0, not step 1 (so step 2 still locked)
    const { stepButton } = setup({ currentStep: 1, completedSteps: [0] });
    // canNavigateTo(2) = 2 <= 1 (false) || completedSteps.includes(1) (false) → false
    expect(stepButton(2)).toBeDisabled();
  });
});

// ─── onStepClick wiring ───────────────────────────────────────────────────────

describe('onStepClick wiring', () => {
  it('clicking an enabled step calls onStepClick with that step number', () => {
    const { onStepClick, stepButton } = setup({ currentStep: 1, completedSteps: [] });
    fireEvent.click(stepButton(1));
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it('clicking an enabled step 2 calls onStepClick(2)', () => {
    const { onStepClick, stepButton } = setup({ currentStep: 2, completedSteps: [1] });
    fireEvent.click(stepButton(2));
    expect(onStepClick).toHaveBeenCalledWith(2);
  });

  it('clicking a disabled step does NOT call onStepClick', () => {
    const { onStepClick, stepButton } = setup({ currentStep: 1, completedSteps: [] });
    fireEvent.click(stepButton(2));
    expect(onStepClick).not.toHaveBeenCalled();
  });
});

// ─── isCalculating guard ──────────────────────────────────────────────────────

describe('isCalculating', () => {
  it('disables all step buttons while calculating', () => {
    const { stepButton } = setup({ currentStep: 3, completedSteps: [1, 2], isCalculating: true });
    expect(stepButton(1)).toBeDisabled();
    expect(stepButton(2)).toBeDisabled();
    expect(stepButton(3)).toBeDisabled();
  });

  it('does not call onStepClick while calculating even when clicking currentStep', () => {
    const { onStepClick, stepButton } = setup({
      currentStep: 1,
      completedSteps: [],
      isCalculating: true,
    });
    fireEvent.click(stepButton(1));
    expect(onStepClick).not.toHaveBeenCalled();
  });
});

// ─── Mode badge ───────────────────────────────────────────────────────────────

describe('mode badge', () => {
  it('renders the mode badge with aria-label "Switch trip mode"', () => {
    setup({ tripMode: 'plan' });
    expect(screen.getByRole('button', { name: /switch trip mode/i })).toBeInTheDocument();
  });

  it('shows "Plan" label for plan mode', () => {
    setup({ tripMode: 'plan' });
    expect(screen.getByRole('button', { name: /switch trip mode/i }).textContent).toMatch(/plan/i);
  });

  it('shows "Adventure" label for adventure mode', () => {
    setup({ tripMode: 'adventure' });
    expect(screen.getByRole('button', { name: /switch trip mode/i }).textContent).toMatch(/adventure/i);
  });

  it('clicking the mode badge calls setShowModeSwitcher to toggle it', () => {
    const { setShowModeSwitcher } = setup({ tripMode: 'plan', showModeSwitcher: false });
    fireEvent.click(screen.getByRole('button', { name: /switch trip mode/i }));
    expect(setShowModeSwitcher).toHaveBeenCalled();
  });
});

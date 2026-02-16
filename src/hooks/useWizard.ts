import { useState, useMemo, useCallback, useRef } from 'react';
import type { Location, Vehicle } from '../types';

export type PlanningStep = 1 | 2 | 3;

interface UseWizardOptions {
  locations: Location[];
  vehicle: Vehicle;
  onCalculate: () => Promise<void>;
}

interface UseWizardReturn {
  // State
  planningStep: PlanningStep;
  completedSteps: number[];

  // Validation
  canProceedFromStep1: boolean;
  canProceedFromStep2: boolean;

  // Actions
  goToNextStep: () => void;
  goToPrevStep: () => void;
  goToStep: (step: PlanningStep) => void;
  forceStep: (step: PlanningStep) => void;
  markStepComplete: (step: number) => void;
  resetWizard: () => void;
}

export function useWizard({
  locations,
  vehicle,
  onCalculate,
}: UseWizardOptions): UseWizardReturn {
  const [planningStep, setPlanningStep] = useState<PlanningStep>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const completedRef = useRef<number[]>([]);

  // Step 1 validation: Must have origin and destination with names
  const canProceedFromStep1 = useMemo(() => {
    const hasOrigin = locations.some(l => l.type === 'origin' && l.name);
    const hasDest = locations.some(l => l.type === 'destination' && l.name);
    return hasOrigin && hasDest;
  }, [locations]);

  // Step 2 validation: Must have valid vehicle stats
  const canProceedFromStep2 = useMemo(() => {
    return (
      vehicle.fuelEconomyCity > 0 &&
      vehicle.fuelEconomyHwy > 0 &&
      vehicle.tankSize > 0
    );
  }, [vehicle]);

  const markStepComplete = useCallback((step: number) => {
    // Update ref synchronously BEFORE the state setter (ref survives batched updates)
    if (!completedRef.current.includes(step)) {
      completedRef.current = [...completedRef.current, step];
    }
    setCompletedSteps(completedRef.current);
  }, []);

  const goToNextStep = useCallback(() => {
    if (planningStep === 1 && canProceedFromStep1) {
      markStepComplete(1);
      setPlanningStep(2);
    } else if (planningStep === 2 && canProceedFromStep2) {
      // Step 2 → 3 triggers calculation
      onCalculate();
    }
  }, [planningStep, canProceedFromStep1, canProceedFromStep2, markStepComplete, onCalculate]);

  const goToPrevStep = useCallback(() => {
    if (planningStep > 1) {
      setPlanningStep((planningStep - 1) as PlanningStep);
    }
  }, [planningStep]);

  const goToStep = useCallback((step: PlanningStep) => {
    // Use ref to read latest completedSteps (survives batched updates)
    setPlanningStep(prev => {
      if (step < prev || completedRef.current.includes(step)) return step;
      return prev;
    });
  }, []);

  // Force-navigate to a step (no guards, for trusted callers like onCalculationComplete)
  const forceStep = useCallback((step: PlanningStep) => {
    setPlanningStep(step);
  }, []);

  const resetWizard = useCallback(() => {
    setPlanningStep(1);
    setCompletedSteps([]);
  }, []);

  return {
    planningStep,
    completedSteps,
    canProceedFromStep1,
    canProceedFromStep2,
    goToNextStep,
    goToPrevStep,
    goToStep,
    forceStep,
    markStepComplete,
    resetWizard,
  };
}

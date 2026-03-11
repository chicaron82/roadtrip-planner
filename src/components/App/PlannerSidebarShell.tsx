import type React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { StepsBanner } from '../StepsBanner';
import { WizardContent } from '../WizardContent';
import { PlanningStepContent } from '../Steps/PlanningStepContent';
import { SwipeableWizard } from '../UI/SwipeableWizard';
import { ErrorFallback } from '../UI/ErrorFallback';
import type { PlanningStep } from '../../hooks';
import type { GhostCarState } from '../../hooks/useGhostCar';
import type { MarkerCategory, POICategory, TripMode } from '../../types';

interface PlannerSidebarShellProps {
  tripMode: TripMode;
  onRevealChange: (revealed: boolean) => void;
  planningStep: PlanningStep;
  completedSteps: number[];
  isCalculating: boolean;
  onStepClick: (step: PlanningStep) => void;
  showModeSwitcher: boolean;
  setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  modeSwitcherRef: React.RefObject<HTMLDivElement | null>;
  onSwitchMode: (mode: TripMode) => void;
  ghostCar: GhostCarState | null;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  onReset: () => void;
  markerCategories: MarkerCategory[];
  loadingCategory: string | null;
  onToggleCategory: (id: POICategory) => void;
  error: string | null;
  onClearError: () => void;
  stepProps: React.ComponentProps<typeof PlanningStepContent>;
}

export function PlannerSidebarShell({
  tripMode,
  onRevealChange,
  planningStep,
  completedSteps,
  isCalculating,
  onStepClick,
  showModeSwitcher,
  setShowModeSwitcher,
  modeSwitcherRef,
  onSwitchMode,
  ghostCar,
  canProceed,
  onNext,
  onBack,
  onReset,
  markerCategories,
  loadingCategory,
  onToggleCategory,
  error,
  onClearError,
  stepProps,
}: PlannerSidebarShellProps) {
  return (
    <div className="absolute inset-0 z-20 md:inset-auto md:left-6 md:top-6 md:bottom-6 md:w-[420px] pointer-events-none">
      <SwipeableWizard tripMode={tripMode} onRevealChange={onRevealChange}>
        <div className="sidebar-dark mee-panel w-full h-full flex flex-col pointer-events-auto md:rounded-[20px]">
          <StepsBanner
            currentStep={planningStep}
            completedSteps={completedSteps}
            tripMode={tripMode}
            isCalculating={isCalculating}
            onStepClick={onStepClick}
            showModeSwitcher={showModeSwitcher}
            setShowModeSwitcher={setShowModeSwitcher}
            modeSwitcherRef={modeSwitcherRef}
            onSwitchMode={onSwitchMode}
            ghostCar={ghostCar}
          />
          <WizardContent
            planningStep={planningStep}
            canProceed={canProceed}
            isCalculating={isCalculating}
            onNext={onNext}
            onBack={onBack}
            onReset={onReset}
            tripMode={tripMode}
            markerCategories={markerCategories}
            loadingCategory={loadingCategory}
            onToggleCategory={onToggleCategory}
            error={error}
            onClearError={onClearError}
          >
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <PlanningStepContent {...stepProps} />
            </ErrorBoundary>
          </WizardContent>
        </div>
      </SwipeableWizard>
    </div>
  );
}
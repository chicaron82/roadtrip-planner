import type React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { StepsBanner } from '../StepsBanner';
import { WizardContent } from '../WizardContent';
import { PlanningStepContent } from '../Steps/PlanningStepContent';
import { SwipeableWizard } from '../UI/SwipeableWizard';
import { ErrorFallback } from '../UI/ErrorFallback';
import { SettingsPanel } from '../Settings/SettingsPanel';
import type { PlanningStep } from '../../hooks';
import type { GhostCarState } from '../../hooks/useGhostCar';
import type { MarkerCategory, POICategory, TripMode, TripSummary, Vehicle, TripSettings } from '../../types';
import { LiveReflectionBar } from './LiveReflectionBar';

interface PlannerFullscreenShellProps {
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
  calculationMessage?: string | null;
  stepProps: React.ComponentProps<typeof PlanningStepContent>;
  // Live reflection bar (shown at Step 2+ once a calculation exists)
  liveReflection?: { summary: TripSummary; vehicle: Vehicle; settings: TripSettings } | null;
}

export function PlannerFullscreenShell({
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
  calculationMessage,
  stepProps,
  liveReflection,
}: PlannerFullscreenShellProps) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none md:flex md:justify-center md:items-stretch md:py-6">
      <SwipeableWizard tripMode={tripMode} onRevealChange={onRevealChange}>
        <div className="sidebar-dark mee-panel relative w-full h-full flex flex-col pointer-events-auto md:rounded-[20px] md:max-w-[620px]">
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
          {planningStep >= 2 && liveReflection && (
            <LiveReflectionBar
              summary={liveReflection.summary}
              vehicle={liveReflection.vehicle}
              settings={liveReflection.settings}
            />
          )}
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
            calculationMessage={calculationMessage}
          >
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <PlanningStepContent {...stepProps} />
            </ErrorBoundary>
          </WizardContent>
          <SettingsPanel />
        </div>
      </SwipeableWizard>
    </div>
  );
}
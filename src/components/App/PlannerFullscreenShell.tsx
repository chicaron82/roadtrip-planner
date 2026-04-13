import type React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { StepsBanner } from '../StepsBanner';
import { WizardContent } from '../WizardContent';
import { PlanningStepContent } from '../Steps/PlanningStepContent';
import { ErrorFallback } from '../UI/ErrorFallback';
import { SettingsPanel } from '../Settings/SettingsPanel';
import type { TripSummary, Vehicle, TripSettings } from '../../types';
import { LiveReflectionBar } from './LiveReflectionBar';
import { usePlanner } from '../../contexts';

export type PlannerFullscreenShellProps = {
  stepProps: React.ComponentProps<typeof PlanningStepContent>;
  /** Live reflection bar (shown at Step 2+ once a calculation exists) */
  liveReflection?: { summary: TripSummary; vehicle: Vehicle; settings: TripSettings } | null;
};

export function PlannerFullscreenShell({
  stepProps,
  liveReflection,
}: PlannerFullscreenShellProps) {
  const { planningStep } = usePlanner();

  return (
    <div className="absolute inset-0 z-20 pointer-events-none md:flex md:justify-center md:items-stretch md:py-6">
      <div className="sidebar-dark mee-panel relative w-full h-full flex flex-col pointer-events-auto md:max-w-[620px]">
        <StepsBanner />
        {planningStep >= 2 && liveReflection && (
          <LiveReflectionBar
            summary={liveReflection.summary}
            vehicle={liveReflection.vehicle}
            settings={liveReflection.settings}
          />
        )}
        <WizardContent>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <PlanningStepContent {...stepProps} />
          </ErrorBoundary>
        </WizardContent>
        <SettingsPanel />
      </div>
    </div>
  );
}
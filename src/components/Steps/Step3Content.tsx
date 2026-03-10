import type { HistoryTripSnapshot } from '../../types';
import { OvernightStopPrompt } from '../Trip/StepHelpers/OvernightStopPrompt';
import { EstimateBreakdown } from '../Trip/StepHelpers/EstimateBreakdown';
import type { PlanningStep } from '../../hooks';
import type { UseStep3ControllerReturn } from '../../hooks/useStep3Derivations';
import { TripViewer } from '../Trip/Viewer/TripViewer';
import { Step3Header } from './Step3Header';
import { Step3HealthSection } from './Step3HealthSection';
import { Step3CommitSection } from './Step3CommitSection';
import { Step3HistorySection } from './Step3HistorySection';
import { Step3EmptyState } from './Step3EmptyState';

export interface Step3ContentProps {
  controller: UseStep3ControllerReturn;
  history: HistoryTripSnapshot[];
  onGoToStep: (step: PlanningStep) => void;
  onLoadHistoryTrip?: (trip: HistoryTripSnapshot) => void;
}

export function Step3Content({
  controller,
  history,
  onGoToStep,
  onLoadHistoryTrip,
}: Step3ContentProps) {
  const { estimate, header, overnightPrompt, health, viewer, commit } = controller;

  return (
    <div className="space-y-4">
      {estimate && <EstimateBreakdown estimate={estimate} />}

      <Step3Header {...header} />

      {overnightPrompt && (
        <OvernightStopPrompt
          suggestedLocation={overnightPrompt.suggestedLocation}
          hoursBeforeStop={overnightPrompt.hoursBeforeStop}
          distanceBeforeStop={overnightPrompt.distanceBeforeStop}
          numTravelers={overnightPrompt.numTravelers}
          arrivalTime={overnightPrompt.arrivalTime}
          departureTime={overnightPrompt.departureTime}
          onAccept={overnightPrompt.onAccept}
          onDecline={overnightPrompt.onDecline}
        />
      )}

      {viewer && health && commit ? (
        <>
          <Step3HealthSection {...health} />

          <TripViewer {...viewer} />

          <Step3CommitSection {...commit} />
        </>
      ) : (
        <Step3EmptyState onGoToStep={onGoToStep} />
      )}

      <Step3HistorySection history={history} onLoadHistoryTrip={onLoadHistoryTrip} />
    </div>
  );
}

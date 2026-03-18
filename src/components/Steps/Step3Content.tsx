import type { HistoryTripSnapshot, TripSettings } from '../../types';
import { OvernightStopPrompt } from '../Trip/StepHelpers/OvernightStopPrompt';
import { EstimateBreakdown } from '../Trip/StepHelpers/EstimateBreakdown';
import type { PlanningStep } from '../../hooks';
import type { UseStep3ControllerReturn } from '../../hooks/useStep3Derivations';
import { TripViewer } from '../Trip/Viewer/TripViewer';
import { TripSignatureCard } from '../Trip/TripSignatureCard';
import { Step3Header } from './Step3Header';
import { Step3HealthSection } from './Step3HealthSection';
import { Step3CommitSection } from './Step3CommitSection';
import { Step3HistorySection } from './Step3HistorySection';
import { RecentJournalsList } from '../Trip/Journal/RecentJournalsList';
import { Step3EmptyState } from './Step3EmptyState';
import { useRevealAnimation } from '../../hooks/useRevealAnimation';
import { TunePanel } from '../Icebreaker/TunePanel';
import { useTripCore, useTimeline } from '../../contexts/TripContext';

export interface Step3ContentProps {
  controller: UseStep3ControllerReturn;
  history: HistoryTripSnapshot[];
  onGoToStep: (step: PlanningStep) => void;
  onLoadHistoryTrip?: (trip: HistoryTripSnapshot) => void;
  onTune?: (patch: Partial<TripSettings>) => void;
}

// Shared Tailwind classes for reveal layer transitions.
// motion-safe: respects prefers-reduced-motion — no animation for users who opt out.
const revealBase = 'motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out';
const visible   = 'opacity-100 translate-y-0';
const hidden    = 'opacity-0 translate-y-2';

export function Step3Content({
  controller,
  history,
  onGoToStep,
  onLoadHistoryTrip,
  onTune,
}: Step3ContentProps) {
  const { estimate, header, overnightPrompt, health, viewer, commit, signatureCard } = controller;
  const { icebreakerOrigin, settings } = useTripCore();
  const { summary } = useTimeline();

  const { layer1, layer2, layer3 } = useRevealAnimation(!!signatureCard);

  return (
    <div className="space-y-4">
      {/* Always visible — pre-calculation estimate and step header */}
      {estimate && <EstimateBreakdown estimate={estimate} />}

      {/* Layer 1 — Trip identity: Signature Card arrives first */}
      {signatureCard && (
        <div className={`${revealBase} ${layer1 ? visible : hidden}`}>
          <TripSignatureCard model={signatureCard} />
        </div>
      )}

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
          {/* Layer 2 — Trip shape: health + timeline follow at 150ms */}
          <div className={`space-y-4 ${revealBase} ${layer2 ? visible : hidden}`}>
            <Step3HealthSection {...health} />
            <TripViewer {...viewer} />
          </div>

          {/* Tune Panel — post-reveal quick adjustments (icebreaker users only) */}
          {icebreakerOrigin && summary && onTune && (
            <div className={`${revealBase} ${layer2 ? visible : hidden}`}>
              <TunePanel settings={settings} summary={summary} onTune={onTune} />
            </div>
          )}

          {/* Layer 3 — Next actions: commit section closes at 280ms */}
          <div className={`${revealBase} ${layer3 ? visible : hidden}`}>
            <Step3CommitSection {...commit} />
          </div>
        </>
      ) : (
        <Step3EmptyState onGoToStep={onGoToStep} />
      )}

      {viewer?.viewMode === 'journal'
        ? <RecentJournalsList />
        : <Step3HistorySection history={history} onLoadHistoryTrip={onLoadHistoryTrip} />
      }
    </div>
  );
}

import type { TimedEvent } from '../../lib/trip-timeline';
import type { TripPrintViewProps } from '../Trip/StepHelpers/TripPrintView';
import type { ViewMode } from '../Trip/Journal/JournalModeToggle';
import type { TripMode, TripJournal } from '../../types';
import { ConfirmTripCard } from '../Trip/StepHelpers/ConfirmTripCard';
import { TripBottomActions } from '../Trip/StepHelpers/TripBottomActions';

interface Step3CommitSectionProps {
  totalDays: number;
  printInput: TripPrintViewProps['printInput'];
  viewMode: ViewMode;
  tripConfirmed: boolean;
  addedStopCount: number;
  shareUrl: string | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripMode?: TripMode;
  journal?: TripJournal | null;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onSetJournalMode: () => void;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export function Step3CommitSection({
  totalDays,
  printInput,
  viewMode,
  tripConfirmed,
  addedStopCount,
  shareUrl,
  precomputedEvents,
  isCalculating,
  tripMode,
  journal,
  onConfirmTrip,
  onUnconfirmTrip,
  onSetJournalMode,
  onOpenGoogleMaps,
  onCopyShareLink,
}: Step3CommitSectionProps) {
  return (
    <>
      {viewMode === 'plan' && (
        <ConfirmTripCard
          confirmed={tripConfirmed}
          addedStopCount={addedStopCount}
          totalDays={totalDays}
          tripMode={tripMode}
          onConfirm={onConfirmTrip}
          onUnconfirm={onUnconfirmTrip}
          onGoToJournal={onSetJournalMode}
        />
      )}

      <TripBottomActions
        printInput={printInput}
        shareUrl={shareUrl}
        precomputedEvents={precomputedEvents}
        isCalculating={isCalculating}
        journal={journal}
        onOpenGoogleMaps={onOpenGoogleMaps}
        onCopyShareLink={onCopyShareLink}
      />
    </>
  );
}
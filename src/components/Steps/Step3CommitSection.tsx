import type { TimedEvent } from '../../lib/trip-timeline';
import type { TripSettings, TripSummary, Vehicle } from '../../types';
import type { ViewMode } from '../Trip/Journal/JournalModeToggle';
import { ConfirmTripCard } from '../Trip/StepHelpers/ConfirmTripCard';
import { TripBottomActions } from '../Trip/StepHelpers/TripBottomActions';

interface Step3CommitSectionProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  viewMode: ViewMode;
  tripConfirmed: boolean;
  addedStopCount: number;
  shareUrl: string | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onSetJournalMode: () => void;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export function Step3CommitSection({
  summary,
  settings,
  vehicle,
  viewMode,
  tripConfirmed,
  addedStopCount,
  shareUrl,
  precomputedEvents,
  isCalculating,
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
          totalDays={summary.days?.length ?? 1}
          onConfirm={onConfirmTrip}
          onUnconfirm={onUnconfirmTrip}
          onGoToJournal={onSetJournalMode}
        />
      )}

      <TripBottomActions
        summary={summary}
        settings={settings}
        vehicle={vehicle}
        shareUrl={shareUrl}
        precomputedEvents={precomputedEvents}
        isCalculating={isCalculating}
        onOpenGoogleMaps={onOpenGoogleMaps}
        onCopyShareLink={onCopyShareLink}
      />
    </>
  );
}
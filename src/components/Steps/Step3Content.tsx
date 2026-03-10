import type { Location, Vehicle, TripSettings, TripSummary, HistoryTripSnapshot, POISuggestion, TripJournal, StopType, TripMode, TripChallenge } from '../../types';
import { OvernightStopPrompt } from '../Trip/StepHelpers/OvernightStopPrompt';
import { type ViewMode } from '../Trip/Journal/JournalModeToggle';
import { EstimateBreakdown } from '../Trip/StepHelpers/EstimateBreakdown';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { PlanningStep } from '../../hooks';
import type { TimedEvent } from '../../lib/trip-timeline';
import { useTimeline } from '../../contexts/TripContext';
import { useStep3Controller } from '../../hooks/useStep3Controller';
import { TripViewer } from '../Trip/Viewer/TripViewer';
import { Step3Header } from './Step3Header';
import { Step3HealthSection } from './Step3HealthSection';
import { Step3CommitSection } from './Step3CommitSection';
import { Step3HistorySection } from './Step3HistorySection';
import { Step3EmptyState } from './Step3EmptyState';

interface Step3ContentProps {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  tripMode: TripMode;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  history: HistoryTripSnapshot[];
  shareUrl: string | null;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onDismissOvernight: () => void;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  onGoToStep: (step: PlanningStep) => void;
  externalStops?: SuggestedStop[];
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripConfirmed: boolean;
  addedStopCount: number;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onLoadHistoryTrip?: (trip: HistoryTripSnapshot) => void;
}

export function Step3Content({
  summary,
  settings,
  vehicle,
  tripMode,
  viewMode,
  setViewMode,
  activeJournal,
  activeChallenge,
  showOvernightPrompt,
  suggestedOvernightStop,
  poiSuggestions,
  poiInference,
  isLoadingPOIs,
  poiPartialResults,
  poiFetchFailed,
  history,
  shareUrl,
  onOpenGoogleMaps,
  onCopyShareLink,
  onStartJournal,
  onUpdateJournal,
  onUpdateStopType,
  onDismissOvernight,
  onAddPOI,
  onDismissPOI,
  onGoToStep,
  externalStops,
  precomputedEvents,
  isCalculating,
  tripConfirmed,
  addedStopCount,
  onConfirmTrip,
  onUnconfirmTrip,
  onLoadHistoryTrip,
}: Step3ContentProps) {
  const {
    addDayActivity, updateDayActivity, removeDayActivity,
    updateDayNotes, updateDayTitle, updateDayType, updateDayOvernight,
    canonicalTimeline,
  } = useTimeline();

  const { feasibility, estimate, overview, arrivalInfo, overnightTimes } = useStep3Controller({
    summary, settings, vehicle, tripMode, precomputedEvents, suggestedOvernightStop,
  });

  return (
    <div className="space-y-4">
      {estimate && <EstimateBreakdown estimate={estimate} />}

      <Step3Header
        summary={summary}
        settings={settings}
        vehicle={vehicle}
        shareUrl={shareUrl}
        difficulty={overview?.difficulty}
        precomputedEvents={precomputedEvents}
        isCalculating={isCalculating}
        onOpenGoogleMaps={onOpenGoogleMaps}
        onCopyShareLink={onCopyShareLink}
      />

      {showOvernightPrompt && suggestedOvernightStop && summary && (
        <OvernightStopPrompt
          suggestedLocation={suggestedOvernightStop}
          hoursBeforeStop={(summary.totalDurationMinutes / 60) * 0.5}
          distanceBeforeStop={summary.totalDistanceKm * 0.5}
          numTravelers={settings.numTravelers}
          arrivalTime={overnightTimes.arrivalTime}
          departureTime={overnightTimes.departureTime}
          onAccept={() => {
            if (!summary) return;
            const segmentIndex = summary.segments.findIndex(
              (seg) => seg.to.name === suggestedOvernightStop.name
            );
            if (segmentIndex >= 0) {
              onUpdateStopType(segmentIndex, 'overnight');
            }
            onDismissOvernight();
          }}
          onDecline={onDismissOvernight}
        />
      )}

      {summary ? (
        <>
          <Step3HealthSection
            summary={summary}
            settings={settings}
            viewMode={viewMode}
            tripMode={tripMode}
            activeJournal={activeJournal}
            tripConfirmed={tripConfirmed}
            arrivalInfo={arrivalInfo}
            feasibility={feasibility}
            setViewMode={setViewMode}
          />

          <TripViewer
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            canonicalTimeline={canonicalTimeline}
            viewMode={viewMode}
            activeJournal={activeJournal}
            activeChallenge={activeChallenge}
            tripMode={tripMode}
            onStartJournal={onStartJournal}
            onUpdateJournal={onUpdateJournal}
            onUpdateStopType={onUpdateStopType}
            onUpdateDayNotes={updateDayNotes}
            onUpdateDayTitle={updateDayTitle}
            onUpdateDayType={updateDayType}
            onAddDayActivity={addDayActivity}
            onUpdateDayActivity={updateDayActivity}
            onRemoveDayActivity={removeDayActivity}
            onUpdateOvernight={updateDayOvernight}
            poiSuggestions={poiSuggestions}
            poiInference={poiInference}
            isLoadingPOIs={isLoadingPOIs}
            poiPartialResults={poiPartialResults}
            poiFetchFailed={poiFetchFailed}
            onAddPOI={onAddPOI}
            onDismissPOI={onDismissPOI}
            externalStops={externalStops}
          />

          <Step3CommitSection
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            viewMode={viewMode}
            tripConfirmed={tripConfirmed}
            addedStopCount={addedStopCount}
            shareUrl={shareUrl}
            precomputedEvents={precomputedEvents}
            onConfirmTrip={onConfirmTrip}
            onUnconfirmTrip={onUnconfirmTrip}
            onSetJournalMode={() => setViewMode('journal')}
            onOpenGoogleMaps={onOpenGoogleMaps}
            onCopyShareLink={onCopyShareLink}
          />
        </>
      ) : (
        <Step3EmptyState onGoToStep={onGoToStep} />
      )}

      <Step3HistorySection history={history} onLoadHistoryTrip={onLoadHistoryTrip} />
    </div>
  );
}

import { useState, useMemo } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary, POISuggestion, TripJournal, StopType, DayType, OvernightStop, TripMode, TripChallenge } from '../../types';
import { OvernightStopPrompt } from '../Trip/OvernightStopPrompt';
import { type ViewMode } from '../Trip/JournalModeToggle';
import { analyzeFeasibility } from '../../lib/feasibility';
import { EstimateBreakdown } from '../Trip/EstimateBreakdown';
import { generateEstimate } from '../../lib/estimate-service';
import { generateTripOverview } from '../../lib/trip-analyzer';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { PlanningStep } from '../../hooks';
import type { TimedEvent } from '../../lib/trip-timeline';
import type { CanonicalTripTimeline } from '../../lib/canonical-trip';
import { useTripContext } from '../../contexts/TripContext';
import { Step3Header } from './Step3Header';
import { Step3HealthSection } from './Step3HealthSection';
import { Step3TimelineSection } from './Step3TimelineSection';
import { Step3CommitSection } from './Step3CommitSection';
import { Step3HistorySection } from './Step3HistorySection';
import { Step3EmptyState } from './Step3EmptyState';
import type { Step3ArrivalInfo } from './step3-types';

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
  history: TripSummary[];
  shareUrl: string | null;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  onDismissOvernight: () => void;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  onGoToStep: (step: PlanningStep) => void;
  externalStops?: SuggestedStop[];
  precomputedEvents?: TimedEvent[];
  canonicalTimeline?: CanonicalTripTimeline | null;
  tripConfirmed: boolean;
  addedStopCount: number;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onLoadHistoryTrip?: (trip: TripSummary) => void;
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
  history,
  shareUrl,
  onOpenGoogleMaps,
  onCopyShareLink,
  onStartJournal,
  onUpdateJournal,
  onUpdateStopType,
  onUpdateDayNotes,
  onUpdateDayTitle,
  onUpdateDayType,
  onUpdateOvernight,
  onDismissOvernight,
  onAddPOI,
  onDismissPOI,
  onGoToStep,
  externalStops,
  precomputedEvents,
  canonicalTimeline,
  tripConfirmed,
  addedStopCount,
  onConfirmTrip,
  onUnconfirmTrip,
  onLoadHistoryTrip,
}: Step3ContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isJournalFullscreen, setIsJournalFullscreen] = useState(false);
  const { addDayActivity, updateDayActivity, removeDayActivity } = useTripContext();

  const feasibility = useMemo(
    () => summary ? analyzeFeasibility(summary, settings) : null,
    [summary, settings],
  );

  // Generate estimate when in estimate mode
  const estimate = useMemo(() => {
    if (tripMode !== 'estimate' || !summary) return null;
    return generateEstimate(summary, vehicle, settings);
  }, [tripMode, summary, vehicle, settings]);

  // Trip difficulty badge
  const overview = useMemo(
    () => summary ? generateTripOverview(summary, settings) : null,
    [summary, settings],
  );

  // Arrival hero: destination name + ETA
  const arrivalInfo = useMemo<Step3ArrivalInfo | null>(() => {
    if (!summary) return null;
    const lastSeg = summary.segments.at(-1);
    const canonicalArrival = precomputedEvents
      ?.filter(event => event.type === 'arrival')
      .at(-1);
    const arrivalTime = canonicalArrival?.arrivalTime
      ?? (lastSeg?.arrivalTime ? new Date(lastSeg.arrivalTime) : null);
    if (!arrivalTime) return null;
    const d = new Date(arrivalTime);
    if (isNaN(d.getTime())) return null;
    const time = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (settings.isRoundTrip && summary.roundTripMidpoint) {
      const destSeg = summary.segments[summary.roundTripMidpoint - 1];
      return { dest: destSeg?.to.name ?? lastSeg?.to.name ?? 'Destination', time, isRoundTrip: true as const };
    }
    return { dest: lastSeg?.to.name ?? 'Destination', time, isRoundTrip: false as const };
  }, [precomputedEvents, summary, settings]);

  // Overnight stop prompt times — derived from segment data and settings
  const overnightTimes = useMemo(() => {
    let arrivalTime = '5:00 PM';
    let departureTime = '8:00 AM';

    if (suggestedOvernightStop && summary) {
      const overnightSeg = summary.segments.find(seg => seg.to.name === suggestedOvernightStop.name);
      if (overnightSeg?.arrivalTime) {
        const d = new Date(overnightSeg.arrivalTime);
        if (!isNaN(d.getTime())) {
          arrivalTime = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
      }
    }

    if (settings.departureTime) {
      const [hStr, mStr] = settings.departureTime.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        departureTime = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }

    return { arrivalTime, departureTime };
  }, [suggestedOvernightStop, summary, settings.departureTime]);

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

          <Step3TimelineSection
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
            onUpdateDayNotes={onUpdateDayNotes}
            onUpdateDayTitle={onUpdateDayTitle}
            onUpdateDayType={onUpdateDayType}
            onAddDayActivity={addDayActivity}
            onUpdateDayActivity={updateDayActivity}
            onRemoveDayActivity={removeDayActivity}
            onUpdateOvernight={onUpdateOvernight}
            poiSuggestions={poiSuggestions}
            poiInference={poiInference}
            isLoadingPOIs={isLoadingPOIs}
            poiPartialResults={poiPartialResults}
            onAddPOI={onAddPOI}
            onDismissPOI={onDismissPOI}
            externalStops={externalStops}
            isExpanded={isExpanded}
            isJournalFullscreen={isJournalFullscreen}
            setIsExpanded={setIsExpanded}
            setIsJournalFullscreen={setIsJournalFullscreen}
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

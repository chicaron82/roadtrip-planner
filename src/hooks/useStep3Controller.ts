import { useMemo, useCallback } from 'react';
import { analyzeFeasibility } from '../lib/feasibility';
import { generateEstimate } from '../lib/estimate-service';
import { generateTripOverview } from '../lib/trip-analyzer';
import { useTimeline } from '../contexts/TripContext';
import {
  buildStep3ArrivalInfo,
  buildStep3OvernightTimes,
  type UseStep3ControllerOptions,
  type UseStep3ControllerReturn,
} from './useStep3Derivations';
import {
  buildStep3CommitModel,
  buildStep3HeaderModel,
  buildStep3HealthModel,
  buildStep3OvernightPromptModel,
  buildStep3ViewerModel,
} from './useStep3Models';

/**
 * Step 3 derived-state controller.
 *
 * Houses all business-logic derivations for the Step 3 results view so that
 * Step3Content is a pure layout component (renders what it receives, emits
 * user intents upward) rather than an inline analytics engine.
 *
 * Owns:
 *  - Trip feasibility analysis     (analyzeFeasibility)
 *  - Estimate-mode cost summary     (generateEstimate, only in estimate mode)
 *  - Difficulty / confidence badge  (generateTripOverview)
 *  - Arrival hero info              (destination name + ETA from canonical events)
 *  - Overnight prompt timing        (arrival/departure strings for the overnight prompt)
 */
export function useStep3Controller({
  summary,
  settings,
  vehicle,
  tripMode,
  viewMode,
  setViewMode,
  activeJournal,
  activeChallenge,
  tripConfirmed,
  addedStopCount,
  shareUrl,
  precomputedEvents,
  isCalculating,
  suggestedOvernightStop,
  showOvernightPrompt,
  poiSuggestions,
  poiInference,
  isLoadingPOIs,
  poiPartialResults,
  poiFetchFailed,
  externalStops,
  onOpenGoogleMaps,
  onCopyShareLink,
  onStartJournal,
  onUpdateJournal,
  onUpdateStopType,
  onDismissOvernight,
  onAddPOI,
  onDismissPOI,
  onConfirmTrip,
  onUnconfirmTrip,
}: UseStep3ControllerOptions): UseStep3ControllerReturn {
  const {
    addDayActivity,
    updateDayActivity,
    removeDayActivity,
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    updateDayOvernight,
    canonicalTimeline,
  } = useTimeline();

  const feasibility = useMemo(
    () => (summary ? analyzeFeasibility(summary, settings) : null),
    [summary, settings],
  );

  const estimate = useMemo(() => {
    if (tripMode !== 'estimate' || !summary) return null;
    return generateEstimate(summary, vehicle, settings);
  }, [tripMode, summary, vehicle, settings]);

  const overview = useMemo(
    () => (summary ? generateTripOverview(summary, settings) : null),
    [summary, settings],
  );

  const arrivalInfo = useMemo(() => buildStep3ArrivalInfo({
    summary,
    precomputedEvents,
    isRoundTrip: settings.isRoundTrip,
  }), [summary, precomputedEvents, settings.isRoundTrip]);

  const overnightTimes = useMemo(() => buildStep3OvernightTimes({
    suggestedOvernightStop,
    summary,
    departureTime: settings.departureTime,
  }), [suggestedOvernightStop, summary, settings.departureTime]);

  const handleAcceptSuggestedOvernight = useCallback(() => {
    if (!summary || !suggestedOvernightStop) return;

    const segmentIndex = summary.segments.findIndex(
      (segment) => segment.to.name === suggestedOvernightStop.name,
    );

    if (segmentIndex >= 0) {
      onUpdateStopType(segmentIndex, 'overnight');
    }

    onDismissOvernight();
  }, [summary, suggestedOvernightStop, onUpdateStopType, onDismissOvernight]);

  const header = useMemo(() => buildStep3HeaderModel({
    summary,
    settings,
    vehicle,
    shareUrl,
    difficulty: overview?.difficulty,
    precomputedEvents,
    isCalculating,
    onOpenGoogleMaps,
    onCopyShareLink,
  }), [
    summary,
    settings,
    vehicle,
    shareUrl,
    overview,
    precomputedEvents,
    isCalculating,
    onOpenGoogleMaps,
    onCopyShareLink,
  ]);

  const overnightPrompt = useMemo(() => buildStep3OvernightPromptModel({
    showOvernightPrompt,
    suggestedOvernightStop,
    summary,
    numTravelers: settings.numTravelers,
    arrivalTime: overnightTimes.arrivalTime,
    departureTime: overnightTimes.departureTime,
    onAccept: handleAcceptSuggestedOvernight,
    onDecline: onDismissOvernight,
  }), [
    showOvernightPrompt,
    suggestedOvernightStop,
    summary,
    settings.numTravelers,
    overnightTimes,
    handleAcceptSuggestedOvernight,
    onDismissOvernight,
  ]);

  const health = useMemo(() => buildStep3HealthModel({
    summary,
    settings,
    viewMode,
    tripMode,
    activeJournal,
    tripConfirmed,
    arrivalInfo,
    feasibility,
    setViewMode,
  }), [
    summary,
    settings,
    viewMode,
    tripMode,
    activeJournal,
    tripConfirmed,
    arrivalInfo,
    feasibility,
    setViewMode,
  ]);

  const viewer = useMemo(() => buildStep3ViewerModel({
    summary,
    settings,
    vehicle,
    canonicalTimeline,
    viewMode,
    activeJournal,
    activeChallenge,
    tripMode,
    onStartJournal,
    onUpdateJournal,
    onUpdateStopType,
    onUpdateDayNotes: updateDayNotes,
    onUpdateDayTitle: updateDayTitle,
    onUpdateDayType: updateDayType,
    onAddDayActivity: addDayActivity,
    onUpdateDayActivity: updateDayActivity,
    onRemoveDayActivity: removeDayActivity,
    onUpdateOvernight: updateDayOvernight,
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    poiFetchFailed,
    onAddPOI,
    onDismissPOI,
    externalStops,
  }), [
    summary,
    settings,
    vehicle,
    canonicalTimeline,
    viewMode,
    activeJournal,
    activeChallenge,
    tripMode,
    onStartJournal,
    onUpdateJournal,
    onUpdateStopType,
    updateDayNotes,
    updateDayTitle,
    updateDayType,
    addDayActivity,
    updateDayActivity,
    removeDayActivity,
    updateDayOvernight,
    poiSuggestions,
    poiInference,
    isLoadingPOIs,
    poiPartialResults,
    poiFetchFailed,
    onAddPOI,
    onDismissPOI,
    externalStops,
  ]);

  const commit = useMemo(() => buildStep3CommitModel({
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
    onSetJournalMode: () => setViewMode('journal'),
    onOpenGoogleMaps,
    onCopyShareLink,
  }), [
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
    setViewMode,
    onOpenGoogleMaps,
    onCopyShareLink,
  ]);

  return {
    feasibility,
    estimate,
    overview,
    arrivalInfo,
    overnightTimes,
    header,
    overnightPrompt,
    health,
    viewer,
    commit,
  };
}

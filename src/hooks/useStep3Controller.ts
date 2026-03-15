import { useMemo, useCallback } from 'react';
import { analyzeFeasibility } from '../lib/feasibility';
import { generateEstimate } from '../lib/estimate-service';
import { generateTripOverview } from '../lib/trip-analyzer';
import { buildSignatureCardModel } from '../lib/trip-signature-card-model';
import { useTimeline, useTripCore } from '../contexts/TripContext';
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
  isJournalComplete,
  showCompleteOverlay,
  onConfirmJournalComplete,
  onUpdateStopType,
  onDismissOvernight,
  onAddPOI,
  onDismissPOI,
  onConfirmTrip,
  onUnconfirmTrip,
  locations,
}: UseStep3ControllerOptions): UseStep3ControllerReturn {
  const { customTitle } = useTripCore();
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

  // Moved before printInput so subtitle/tripRead can flow into the print artifact.
  const signatureCard = useMemo(() => {
    if (!summary || !feasibility) return null;
    const origin = locations[0];
    const destination = locations[locations.length - 1];
    if (!origin || !destination) return null;
    return buildSignatureCardModel({
      summary,
      settings,
      feasibility,
      originName: origin.name,
      destinationName: destination.name,
      tripMode,
      customTitle: customTitle ?? undefined,
    });
  }, [summary, settings, feasibility, locations, tripMode, customTitle]);

  const printInput = useMemo(() => (
    canonicalTimeline
      ? {
          summary: canonicalTimeline.summary,
          days: canonicalTimeline.days,
          inputs: canonicalTimeline.inputs,
          customTitle: customTitle ?? undefined,
          subtitle: signatureCard?.subtitle,
          tripRead: signatureCard?.tripRead,
        }
      : undefined
  ), [canonicalTimeline, customTitle, signatureCard]);

  const header = useMemo(() => buildStep3HeaderModel({
    hasTrip: !!summary,
    printInput,
    shareUrl,
    difficulty: overview?.difficulty,
    precomputedEvents,
    isCalculating,
    tripMode,
    journal: activeJournal,
    onOpenGoogleMaps,
    onCopyShareLink,
  }), [
    summary,
    printInput,
    shareUrl,
    overview,
    precomputedEvents,
    isCalculating,
    tripMode,
    activeJournal,
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
    isJournalComplete,
    showCompleteOverlay,
    onConfirmJournalComplete,
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
    isJournalComplete,
    onConfirmJournalComplete,
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

  // "Open Journal" from ConfirmTripCard — switches view AND starts the journal in
  // one shot so the user doesn't have to click through the StartJournalCTA.
  const handleOpenJournal = useCallback(() => {
    setViewMode('journal');
    if (!activeJournal) {
      const title = customTitle ?? activeChallenge?.title ?? undefined;
      onStartJournal(title);
    }
  }, [setViewMode, activeJournal, customTitle, activeChallenge, onStartJournal]);

  const commit = useMemo(() => buildStep3CommitModel({
    printInput,
    viewMode,
    tripConfirmed,
    addedStopCount,
    shareUrl,
    precomputedEvents,
    isCalculating,
    tripMode,
    journal: activeJournal,
    onConfirmTrip,
    onUnconfirmTrip,
    onSetJournalMode: handleOpenJournal,
    onOpenGoogleMaps,
    onCopyShareLink,
  }), [
    printInput,
    viewMode,
    tripConfirmed,
    addedStopCount,
    shareUrl,
    precomputedEvents,
    isCalculating,
    tripMode,
    activeJournal,
    onConfirmTrip,
    onUnconfirmTrip,
    handleOpenJournal,
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
    signatureCard,
  };
}

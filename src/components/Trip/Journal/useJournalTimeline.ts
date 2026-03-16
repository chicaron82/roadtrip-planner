import { useState, useMemo } from 'react';
import type { TripSettings, TripJournal, JournalEntry, JournalPhoto, QuickCapture } from '../../../types';
import { showToast } from '../../../lib/toast';
import { dispatchCaptureGps } from '../../../hooks/useArrivalSnap';
import { formatDisplayDateInZone, formatTimeInZone, getTripStartTime, lngToIANA } from '../../../lib/trip-timezone';
import { buildAcceptedItineraryProjection } from '../../../lib/accepted-itinerary-projection';
import {
  buildJournalActiveSuggestions,
  buildJournalTimelineStops,
  findJournalEntry,
  resolveJournalTimelineStop,
} from '../../../lib/journal-trip-view';
import type { JournalTimelineSummary } from '../../../lib/trip-summary-slices';

interface UseJournalTimelineParams {
  summary: JournalTimelineSummary;
  settings: TripSettings;
  journal: TripJournal;
  onUpdateJournal: (journal: TripJournal) => void;
}

export function useJournalTimeline({ summary, settings, journal, onUpdateJournal }: UseJournalTimelineParams) {
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureContext, setQuickCaptureContext] = useState<{
    segmentIndex?: number;
    locationName?: string;
  }>({});

  const startTime = useMemo(
    () => getTripStartTime(settings.departureDate, settings.departureTime, summary.segments[0]?.from.lng),
    [settings.departureDate, settings.departureTime, summary.segments],
  );

  const originTimezone = useMemo(() => {
    const originLng = summary.segments[0]?.from.lng;
    return originLng !== undefined ? lngToIANA(originLng) : undefined;
  }, [summary.segments]);

  const activeSuggestions = useMemo(() => buildJournalActiveSuggestions(
    summary,
    settings,
    journal.vehicle,
    summary.days,
    journal.stopOverrides,
  ), [summary, settings, journal.vehicle, journal.stopOverrides]);

  const journalProjection = useMemo(() => buildAcceptedItineraryProjection({
    summary,
    settings,
    vehicle: journal.vehicle,
    days: summary.days,
    startTime,
    activeSuggestions,
  }), [summary, settings, journal.vehicle, startTime, activeSuggestions]);

  const journalStops = useMemo(
    () => buildJournalTimelineStops(journalProjection.simulationItems),
    [journalProjection.simulationItems],
  );

  // Get or create entry for a segment.
  // Looks up by stopId (stable geographic ID) first, falls back to segmentIndex
  // for entries created before this pattern was enforced.
  const getEntry = (segmentIndex: number): JournalEntry | undefined => {
    const projectedStop = resolveJournalTimelineStop(journalStops, segmentIndex);
    return findJournalEntry(journal.entries, projectedStop)
      ?? journal.entries.find(entry => entry.segmentIndex === segmentIndex);
  };

  const currentStop = useMemo(() => {
    for (const stop of journalStops) {
      const entry = findJournalEntry(journal.entries, stop);
      if (!entry || entry.status !== 'visited') return stop;
    }
    return journalStops[journalStops.length - 1];
  }, [journalStops, journal.entries]);

  const currentStopIndex = currentStop?.originalIndex ?? journalStops[journalStops.length - 1]?.originalIndex ?? Math.max(summary.segments.length - 1, 0);

  const realSegmentIndices = useMemo(
    () => new Set(journalStops.map(stop => stop.originalIndex)),
    [journalStops],
  );
  const realWaypointIds = useMemo(
    () => new Set(journalStops.map(stop => stop.segment.to.id).filter((id): id is string => Boolean(id))),
    [journalStops],
  );
  const totalStops = journalStops.length;
  const visitedCount = journal.entries.filter(
    e => e.status === 'visited' &&
      (realWaypointIds.has(e.stopId) || realSegmentIndices.has(e.segmentIndex))
  ).length;
  const progressPercent = totalStops > 0 ? Math.round((visitedCount / totalStops) * 100) : 0;

  // Update an entry
  const handleUpdateEntry = (segmentIndex: number, updates: Partial<JournalEntry>) => {
    const existingEntry = getEntry(segmentIndex);
    const projectedStop = resolveJournalTimelineStop(journalStops, segmentIndex);
    const segment = projectedStop?.segment ?? summary.segments[segmentIndex];
    if (!segment) return;

    let newEntry: JournalEntry;
    if (existingEntry) {
      newEntry = { ...existingEntry, ...updates, updatedAt: new Date() };
    } else {
      // Use stopId as the deterministic entry id — stable across route edits,
      // no timestamp required (duplicate calls naturally resolve to the same id).
      newEntry = {
        id: `entry-${segment.to.id}`,
        stopId: segment.to.id,
        segmentIndex: projectedStop?.originalIndex ?? segmentIndex,
        photos: [],
        notes: '',
        status: 'planned',
        isHighlight: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plannedArrival: segment.arrivalTime ? new Date(segment.arrivalTime) : undefined,
        ...updates,
      };
    }

    const updatedEntries = existingEntry
      ? journal.entries.map(e => (e.id === existingEntry.id ? newEntry : e))
      : [...journal.entries, newEntry];

    onUpdateJournal({ ...journal, entries: updatedEntries, updatedAt: new Date() });
  };

  const handleAddPhoto = (segmentIndex: number, photo: JournalPhoto) => {
    const entry = getEntry(segmentIndex);
    handleUpdateEntry(segmentIndex, { photos: [...(entry?.photos || []), photo] });
  };

  const handleRemovePhoto = (segmentIndex: number, photoId: string) => {
    const entry = getEntry(segmentIndex);
    if (!entry) return;
    handleUpdateEntry(segmentIndex, { photos: entry.photos.filter(p => p.id !== photoId) });
  };

  const handleSaveQuickCapture = (capture: QuickCapture) => {
    onUpdateJournal({
      ...journal,
      quickCaptures: [...journal.quickCaptures, capture],
      stats: { ...journal.stats, photosCount: journal.stats.photosCount + 1 },
      updatedAt: new Date(),
    });
    // Nudge the ghost car if we have real GPS coords
    if (capture.gpsCoords) {
      dispatchCaptureGps({ lat: capture.gpsCoords.lat, lng: capture.gpsCoords.lng });
    }
    showToast({ message: '📸 Memory captured!', type: 'success' });
  };

  const handleOpenQuickCapture = (segmentIndex?: number, locationName?: string) => {
    setQuickCaptureContext({ segmentIndex, locationName });
    setQuickCaptureOpen(true);
  };

  const formatTime = (date: Date, ianaTimezone: string | undefined = originTimezone) =>
    formatTimeInZone(date, ianaTimezone);

  const formatDate = (date: Date, ianaTimezone: string | undefined = originTimezone) =>
    formatDisplayDateInZone(date, ianaTimezone);

  // Reset all entries back to 'planned' so the journey can be re-driven.
  // Notes and photos are preserved — only arrival status is cleared.
  const resetAllStops = () => {
    const resetEntries = journal.entries.map(e => ({
      ...e,
      status: 'planned' as const,
      actualArrival: undefined,
    }));
    onUpdateJournal({ ...journal, entries: resetEntries, updatedAt: new Date() });
    showToast({ message: '↺ Trip reset — ready to drive again', type: 'success' });
  };

  return {
    startTime,
    originTimezone,
    dayStartMap: journalProjection.dayStartMap,
    freeDaysAfterSegment: journalProjection.freeDaysAfterSegment,
    journalStops,
    currentStop,
    currentStopIndex,
    totalStops,
    visitedCount,
    progressPercent,
    quickCaptureOpen,
    setQuickCaptureOpen,
    quickCaptureContext,
    getEntry,
    handleUpdateEntry,
    handleAddPhoto,
    handleRemovePhoto,
    handleSaveQuickCapture,
    handleOpenQuickCapture,
    formatTime,
    formatDate,
    resetAllStops,
  };
}

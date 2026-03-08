import { useState, useMemo } from 'react';
import type { TripSummary, TripSettings, TripJournal, JournalEntry, JournalPhoto, QuickCapture } from '../../types';
import { showToast } from '../../lib/toast';
import { formatDisplayDateInZone, formatTimeInZone, getTripStartTime, lngToIANA } from '../../lib/trip-timezone';
import { buildAcceptedItineraryProjection } from '../../lib/accepted-itinerary-projection';
import { buildJournalActiveSuggestions } from '../../lib/journal-trip-view';

interface UseJournalTimelineParams {
  summary: TripSummary;
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

  // Find current/next stop (first unvisited non-guard stop)
  const currentStopIndex = useMemo(() => {
    for (let i = 0; i < summary.segments.length; i++) {
      if (summary.segments[i].to.id?.startsWith('guard-')) continue;
      const waypointId = summary.segments[i].to.id;
      const entry = journal.entries.find(e =>
        (waypointId && e.stopId === waypointId) || e.segmentIndex === i
      );
      if (!entry || entry.status !== 'visited') return i;
    }
    return summary.segments.length - 1;
  }, [summary.segments, journal.entries]);

  // Calculate progress — exclude border-avoidance guard waypoints
  const realSegmentIndices = useMemo(
    () => new Set(
      summary.segments
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => !s.to.id?.startsWith('guard-'))
        .map(({ i }) => i)
    ),
    [summary.segments],
  );
  // Stable waypoint IDs for the same real stops — progress survives index shifts.
  const realWaypointIds = useMemo(
    () => new Set(
      summary.segments
        .filter(s => s.to.id && !s.to.id.startsWith('guard-'))
        .map(s => s.to.id!)
    ),
    [summary.segments],
  );
  const totalStops = realSegmentIndices.size;
  const visitedCount = journal.entries.filter(
    e => e.status === 'visited' &&
      (realWaypointIds.has(e.stopId) || realSegmentIndices.has(e.segmentIndex))
  ).length;
  const progressPercent = totalStops > 0 ? Math.round((visitedCount / totalStops) * 100) : 0;

  // Get or create entry for a segment.
  // Looks up by stopId (stable geographic ID) first, falls back to segmentIndex
  // for entries created before this pattern was enforced.
  const getEntry = (segmentIndex: number): JournalEntry | undefined => {
    const waypointId = summary.segments[segmentIndex]?.to.id;
    if (waypointId) {
      return (
        journal.entries.find(e => e.stopId === waypointId) ??
        journal.entries.find(e => e.segmentIndex === segmentIndex)
      );
    }
    return journal.entries.find(e => e.segmentIndex === segmentIndex);
  };

  // Update an entry
  const handleUpdateEntry = (segmentIndex: number, updates: Partial<JournalEntry>) => {
    const existingEntry = getEntry(segmentIndex);
    const segment = summary.segments[segmentIndex];

    let newEntry: JournalEntry;
    if (existingEntry) {
      newEntry = { ...existingEntry, ...updates, updatedAt: new Date() };
    } else {
      // Use stopId as the deterministic entry id — stable across route edits,
      // no timestamp required (duplicate calls naturally resolve to the same id).
      newEntry = {
        id: `entry-${segment.to.id}`,
        stopId: segment.to.id,
        segmentIndex,
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

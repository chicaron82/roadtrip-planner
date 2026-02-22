import { useState, useMemo } from 'react';
import type { TripSummary, TripSettings, TripJournal, JournalEntry, JournalPhoto, QuickCapture, TripDay } from '../../types';
import { showToast } from '../../lib/toast';

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
    () => new Date(`${settings.departureDate}T${settings.departureTime}`),
    [settings.departureDate, settings.departureTime],
  );

  // Build map: segmentIndex → TripDay for the first segment of each driving day
  const dayStartMap = useMemo(() => {
    const map = new Map<number, TripDay>();
    if (summary.days) {
      for (const day of summary.days) {
        if (day.segmentIndices.length > 0) {
          map.set(day.segmentIndices[0], day);
        }
      }
    }
    return map;
  }, [summary.days]);

  // Build map: last-segment-index-of-driving-day → free TripDay[]
  const freeDaysAfterSegment = useMemo(() => {
    const map = new Map<number, TripDay[]>();
    if (!summary.days) return map;
    const drivingDays = summary.days.filter(d => d.segmentIndices.length > 0);
    const freeDays = summary.days.filter(d => d.dayType === 'free');
    for (const freeDay of freeDays) {
      const prevDrivingDay = drivingDays
        .filter(d => d.dayNumber < freeDay.dayNumber)
        .sort((a, b) => b.dayNumber - a.dayNumber)[0];
      if (prevDrivingDay) {
        const lastIdx = prevDrivingDay.segmentIndices[prevDrivingDay.segmentIndices.length - 1];
        map.set(lastIdx, [...(map.get(lastIdx) || []), freeDay]);
      }
    }
    return map;
  }, [summary.days]);

  // Find current/next stop (first unvisited non-guard stop)
  const currentStopIndex = useMemo(() => {
    for (let i = 0; i < summary.segments.length; i++) {
      if (summary.segments[i].to.id?.startsWith('guard-')) continue;
      const entry = journal.entries.find(e => e.segmentIndex === i);
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
  const totalStops = realSegmentIndices.size;
  const visitedCount = journal.entries.filter(
    e => realSegmentIndices.has(e.segmentIndex) && e.status === 'visited'
  ).length;
  const progressPercent = totalStops > 0 ? Math.round((visitedCount / totalStops) * 100) : 0;

  // Get or create entry for a segment
  const getEntry = (segmentIndex: number): JournalEntry | undefined =>
    journal.entries.find(e => e.segmentIndex === segmentIndex);

  // Update an entry
  const handleUpdateEntry = (segmentIndex: number, updates: Partial<JournalEntry>) => {
    const existingEntry = getEntry(segmentIndex);
    const segment = summary.segments[segmentIndex];

    let newEntry: JournalEntry;
    if (existingEntry) {
      newEntry = { ...existingEntry, ...updates, updatedAt: new Date() };
    } else {
      newEntry = {
        id: `entry-${segmentIndex}-${Date.now()}`,
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

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (date: Date) =>
    date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return {
    startTime,
    dayStartMap,
    freeDaysAfterSegment,
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
  };
}

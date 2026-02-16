import { useMemo } from 'react';
import { MapPin, Trophy, Clock, Camera, Star, BookOpen } from 'lucide-react';
import type { TripSummary, TripSettings, TripJournal, JournalEntry, JournalPhoto } from '../../types';
import { JournalStopCard, QuickArriveButton } from './JournalStopCard';
import { DayHeader } from './DayHeader';
import { cn } from '../../lib/utils';

interface JournalTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  journal: TripJournal;
  onUpdateJournal: (journal: TripJournal) => void;
  className?: string;
}

export function JournalTimeline({
  summary,
  settings,
  journal,
  onUpdateJournal,
  className,
}: JournalTimelineProps) {
  const startTime = useMemo(
    () => new Date(`${settings.departureDate}T${settings.departureTime}`),
    [settings.departureDate, settings.departureTime]
  );

  // Find current/next stop (first unvisited stop)
  const currentStopIndex = useMemo(() => {
    for (let i = 0; i < summary.segments.length; i++) {
      const entry = journal.entries.find(e => e.segmentIndex === i);
      if (!entry || entry.status !== 'visited') {
        return i;
      }
    }
    return summary.segments.length - 1; // All visited, show last
  }, [summary.segments.length, journal.entries]);

  const currentSegment = summary.segments[currentStopIndex];

  // Get or create entry for a segment
  const getEntry = (segmentIndex: number): JournalEntry | undefined => {
    return journal.entries.find(e => e.segmentIndex === segmentIndex);
  };

  // Update an entry
  const handleUpdateEntry = (segmentIndex: number, updates: Partial<JournalEntry>) => {
    const existingEntry = getEntry(segmentIndex);
    const segment = summary.segments[segmentIndex];

    let newEntry: JournalEntry;
    if (existingEntry) {
      newEntry = {
        ...existingEntry,
        ...updates,
        updatedAt: new Date(),
      };
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

    onUpdateJournal({
      ...journal,
      entries: updatedEntries,
      updatedAt: new Date(),
    });
  };

  // Add photo to entry
  const handleAddPhoto = (segmentIndex: number, photo: JournalPhoto) => {
    const entry = getEntry(segmentIndex);
    const photos = entry?.photos || [];

    handleUpdateEntry(segmentIndex, {
      photos: [...photos, photo],
    });
  };

  // Remove photo from entry
  const handleRemovePhoto = (segmentIndex: number, photoId: string) => {
    const entry = getEntry(segmentIndex);
    if (!entry) return;

    handleUpdateEntry(segmentIndex, {
      photos: entry.photos.filter(p => p.id !== photoId),
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Calculate progress
  const visitedCount = journal.entries.filter(e => e.status === 'visited').length;
  const totalStops = summary.segments.length;
  const progressPercent = Math.round((visitedCount / totalStops) * 100);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Header */}
      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            <h3 className="font-bold text-purple-900">{journal.metadata.title}</h3>
          </div>
          <div className="text-sm font-medium text-purple-700">
            {visitedCount}/{totalStops} stops
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mt-3 text-xs text-purple-600">
          <span className="flex items-center gap-1">
            <Camera className="h-3 w-3" />
            {journal.stats.photosCount} photos
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {journal.stats.highlightsCount} highlights
          </span>
        </div>
      </div>

      {/* Current Stop - Quick Arrive */}
      {currentStopIndex < summary.segments.length && currentSegment && (
        <QuickArriveButton
          stopName={currentSegment.to.name.split(',')[0]}
          onArrive={() => handleUpdateEntry(currentStopIndex, {
            status: 'visited',
            actualArrival: new Date(),
          })}
        />
      )}

      {/* Multi-Day Headers */}
      {summary.days && summary.days.length > 0 && (
        <div className="mb-6">
          {summary.days.map((day, idx) => (
            <DayHeader key={day.dayNumber} day={day} isFirst={idx === 0} />
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-0 pt-2 relative pb-12">
        {/* Timeline Line */}
        <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-border -z-10" />

        {/* Start Node */}
        <div className="flex gap-4 mb-8">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center border-2 border-green-200 shadow-sm z-10">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-0.5">
              Start
            </div>
            <div className="font-bold text-xl">{summary.segments[0]?.from.name || 'Origin'}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3" /> {formatDate(startTime)} • {formatTime(startTime)}
            </div>
          </div>
        </div>

        {/* Stop Cards */}
        {summary.segments.map((segment, index) => {
          const entry = getEntry(index);
          const isDest = index === summary.segments.length - 1;
          const isCurrent = index === currentStopIndex;
          const isVisited = entry?.status === 'visited';

          return (
            <div key={`stop-${index}`} className="flex gap-4 mb-6">
              {/* Timeline Node */}
              <div className="relative flex-shrink-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 transition-all',
                    isDest
                      ? 'bg-yellow-100 text-yellow-600 border-yellow-200'
                      : isVisited
                      ? 'bg-green-500 text-white border-green-400'
                      : isCurrent
                      ? 'bg-purple-100 text-purple-600 border-purple-300 ring-4 ring-purple-100'
                      : 'bg-white text-muted-foreground border-slate-200'
                  )}
                >
                  {isDest ? (
                    <Trophy className="h-5 w-5" />
                  ) : isVisited ? (
                    '✓'
                  ) : (
                    <span className="font-mono text-xs font-bold">{index + 1}</span>
                  )}
                </div>
              </div>

              {/* Journal Card */}
              <div className="flex-1 min-w-0">
                {/* Drive Info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 pl-1">
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <span>🚗</span>
                    <span>{segment.distanceKm.toFixed(0)} km</span>
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {Math.floor(segment.durationMinutes / 60)}h {segment.durationMinutes % 60}m
                    </span>
                  </div>
                </div>

                {/* Journal Stop Card */}
                <JournalStopCard
                  segment={segment}
                  segmentIndex={index}
                  entry={entry}
                  onUpdateEntry={(updates) => handleUpdateEntry(index, updates)}
                  onAddPhoto={(photo) => handleAddPhoto(index, photo)}
                  onRemovePhoto={(photoId) => handleRemovePhoto(index, photoId)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Trip Complete */}
      {visitedCount === totalStops && (
        <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-white p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-xl font-bold text-green-900 mb-2">Trip Complete!</h3>
          <p className="text-sm text-green-700 mb-4">
            You visited all {totalStops} stops and captured {journal.stats.photosCount} memories.
          </p>
          <div className="flex justify-center gap-3">
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
              Export Journal
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
              Share as Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

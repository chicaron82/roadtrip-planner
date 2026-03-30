import { useEffect, useRef } from 'react';
import { MapPin, Trophy, Clock, Camera, Pencil, Trash2, Plus } from 'lucide-react';
import type { TripJournal, JournalEntry, JournalPhoto, QuickCapture, TripDay } from '../../../types';
import type { JournalTimelineSummary } from '../../../lib/trip-summary-slices';
import type { JournalTimelineStop } from '../../../lib/journal-trip-view';
import type { DayStartEntry } from '../../../lib/day-placement-maps';
import { JournalStopCard } from './JournalStopCard';
import { DayHeader } from '../Itinerary/DayHeader';
import { cn } from '../../../lib/utils';

interface JournalTimelineBodyProps {
  startTime: Date;
  originTimezone: string | undefined;
  dayStartMap: Map<number, DayStartEntry[]>;
  freeDaysAfterSegment: Map<number, TripDay[]>;
  journalStops: JournalTimelineStop[];
  currentStopIndex: number;
  journal: TripJournal;
  summary: JournalTimelineSummary;
  isFinalized: boolean;
  getEntry: (index: number) => JournalEntry | undefined;
  handleUpdateEntry: (index: number, updates: Partial<JournalEntry>) => void;
  handleAddPhoto: (index: number, photo: JournalPhoto) => void;
  handleRemovePhoto: (index: number, photoId: string) => void;
  handleOpenQuickCapture: (segmentIndex?: number, locationName?: string) => void;
  handleEditCapture: (capture: QuickCapture) => void;
  handleDeleteCapture: (id: string) => void;
  formatTime: (date: Date, tz?: string) => string;
  formatDate: (date: Date, tz?: string) => string;
}

export function JournalTimelineBody({
  startTime, originTimezone, dayStartMap, freeDaysAfterSegment,
  journalStops, currentStopIndex, journal, summary, isFinalized,
  getEntry, handleUpdateEntry, handleAddPhoto, handleRemovePhoto,
  handleOpenQuickCapture, handleEditCapture, handleDeleteCapture,
  formatTime, formatDate,
}: JournalTimelineBodyProps) {
  // Scroll-reveal: entries fade-in-up as they enter the viewport
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = timelineRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            observer.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 },
    );
    const items = root.querySelectorAll<HTMLElement>('[data-reveal]');
    for (const item of items) {
      item.style.opacity = '0';
      item.style.transform = 'translateY(16px)';
      item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      observer.observe(item);
    }
    return () => observer.disconnect();
  }, [journalStops.length]);

  return (
    <>
      {/* Timeline */}
      <div ref={timelineRef} className="space-y-0 pt-2 relative pb-12">
        <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-border -z-10" />

        {/* Start Node */}
        <div className="flex gap-4 mb-8">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center border-2 border-green-200 shadow-sm z-10">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
          <div className="pt-1">
            <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-0.5">Start</div>
            <div className="font-bold text-xl">{journalStops[0]?.segment.from.name || summary.segments[0]?.from.name || 'Origin'}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3" /> {formatDate(startTime, originTimezone)} • {formatTime(startTime, originTimezone)}
            </div>
          </div>
        </div>

        {/* Stop Cards */}
        {journalStops.map((stop, renderIndex) => {
          const { segment, flatIndex, originalIndex } = stop;
          const dayHeaders = dayStartMap.get(flatIndex) ?? [];
          const entry = getEntry(originalIndex);
          const isDest = renderIndex === journalStops.length - 1;
          const isCurrent = originalIndex === currentStopIndex;
          const isVisited = entry?.status === 'visited';
          const afterFreeDays = freeDaysAfterSegment.get(flatIndex) || [];
          const segmentCaptures = journal.quickCaptures
            .filter(qc => qc.autoTaggedSegment === originalIndex)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          return (
            <div key={`stop-${originalIndex}-${flatIndex}`} data-reveal>
              {dayHeaders.map(({ day, isFirst }) => (
                <DayHeader key={`day-${day.dayNumber}`} day={day} isFirst={isFirst} className="mb-6" />
              ))}

              {/* Inline Add Memory Button — hidden when finalized */}
              {!isFinalized && (
                <div className="flex gap-4 mb-3">
                  <div className="w-10 flex justify-center">
                    <div className="w-0.5 h-6 bg-border" />
                  </div>
                  <button
                    onClick={() => handleOpenQuickCapture(originalIndex, segment.to.name)}
                    className="flex-1 border-2 border-dashed border-purple-200 bg-purple-50/30 hover:bg-purple-50 hover:border-purple-300 rounded-lg px-3 py-2 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-2 text-xs text-purple-600 font-medium">
                      <Plus className="h-3 w-3 group-hover:scale-110 transition-transform" />
                      <span>Add Memory</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Quick Captures for this segment */}
              {segmentCaptures.map((capture) => (
                <div key={capture.id} className="flex gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 border-2 border-purple-200 flex items-center justify-center shadow-sm z-10">
                      <Camera className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="text-2xl">📸</div>
                        <div className="flex-1">
                          <div className="font-semibold text-purple-900 text-sm">
                            {capture.autoTaggedLocation || 'Quick Memory'}
                          </div>
                          <div className="text-xs text-purple-600 mt-0.5">
                            {formatTime(new Date(capture.timestamp))}
                          </div>
                        </div>
                        {!isFinalized && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleEditCapture(capture)}
                              title="Edit memory"
                              className="p-1.5 rounded-md text-purple-400 hover:text-purple-700 hover:bg-purple-100 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCapture(capture.id)}
                              title="Delete memory"
                              className="p-1.5 rounded-md text-purple-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {capture.photo && (
                        <img
                          src={capture.photo.dataUrl}
                          alt={capture.photo.caption || 'Memory'}
                          className="w-full h-40 object-cover rounded-lg mb-2"
                        />
                      )}
                      {capture.photo?.caption && (
                        <p className="text-sm text-purple-700">{capture.photo.caption}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-4 mb-6">
                {/* Timeline Node */}
                <div className="relative flex-shrink-0">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm z-10 transition-all',
                    isDest
                      ? 'bg-yellow-100 text-yellow-600 border-yellow-200'
                      : isVisited
                      ? 'bg-green-500 text-white border-green-400'
                      : isCurrent
                      ? 'bg-purple-100 text-purple-600 border-purple-300 ring-4 ring-purple-100'
                      : 'bg-white text-muted-foreground border-slate-200'
                  )}>
                    {isDest ? <Trophy className="h-5 w-5" /> : isVisited ? '✓' : (
                      <span className="font-mono text-xs font-bold">{renderIndex + 1}</span>
                    )}
                  </div>
                </div>

                {/* Journal Card */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 pl-1">
                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <span>🚗</span>
                      <span>{segment.distanceKm.toFixed(0)} km</span>
                    </div>
                    <span className="text-slate-300">•</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{Math.floor(segment.durationMinutes / 60)}h {Math.round(segment.durationMinutes % 60)}m</span>
                    </div>
                  </div>
                  <JournalStopCard
                    segment={segment}
                    segmentIndex={originalIndex}
                    displayIndex={renderIndex}
                    entry={entry}
                    displayTimezone={segment.timezone ?? segment.weather?.timezone}
                    onUpdateEntry={(updates) => handleUpdateEntry(originalIndex, updates)}
                    onAddPhoto={(photo) => handleAddPhoto(originalIndex, photo)}
                    onRemovePhoto={(photoId) => handleRemovePhoto(originalIndex, photoId)}
                    readOnly={isFinalized}
                  />
                </div>
              </div>

              {afterFreeDays.map(freeDay => (
                <DayHeader
                  key={`free-day-${freeDay.dayNumber}`}
                  day={freeDay}
                  isFirst={false}
                  className="mb-6 mt-4"
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Untagged memories — captured en route without a specific stop */}
      {journal.quickCaptures.some(qc => qc.autoTaggedSegment === undefined) && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-purple-500 uppercase tracking-wider flex items-center gap-2">
            <Camera className="h-3.5 w-3.5" />
            Memories along the way
          </h4>
          {journal.quickCaptures
            .filter(qc => qc.autoTaggedSegment === undefined)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map((capture) => (
              <div key={capture.id} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="text-2xl">📸</div>
                  <div className="flex-1">
                    <div className="font-semibold text-purple-900 text-sm">
                      {capture.autoTaggedLocation || 'Quick Memory'}
                    </div>
                    <div className="text-xs text-purple-600 mt-0.5">
                      {formatTime(new Date(capture.timestamp))}
                    </div>
                  </div>
                  {!isFinalized && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleEditCapture(capture)}
                        title="Edit memory"
                        className="p-1.5 rounded-md text-purple-400 hover:text-purple-700 hover:bg-purple-100 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCapture(capture.id)}
                        title="Delete memory"
                        className="p-1.5 rounded-md text-purple-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {capture.photo && (
                  <img
                    src={capture.photo.dataUrl}
                    alt={capture.photo.caption || 'Memory'}
                    className="w-full h-40 object-cover rounded-lg mb-2"
                  />
                )}
                {capture.photo?.caption && (
                  <p className="text-sm text-purple-700">{capture.photo.caption}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </>
  );
}

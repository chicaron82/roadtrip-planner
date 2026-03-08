import { MapPin, Trophy, Clock, Camera, Star, BookOpen, Plus } from 'lucide-react';
import type { TripSummary, TripSettings, TripJournal } from '../../../types';
import { JournalStopCard, QuickArriveButton } from './JournalStopCard';
import { DayHeader } from '../Itinerary/DayHeader';
import { QuickCaptureDialog } from '../QuickCaptureDialog';
import { TripRecapCard } from '../TripRecapCard';
import { useJournalTimeline } from './useJournalTimeline';
import { cn } from '../../../lib/utils';
import { dispatchStopArrived } from '../../../hooks/useArrivalSnap';

interface JournalTimelineProps {
  summary: TripSummary;
  settings: TripSettings;
  journal: TripJournal;
  onUpdateJournal: (journal: TripJournal) => void;
  className?: string;
}

export function JournalTimeline({ summary, settings, journal, onUpdateJournal, className }: JournalTimelineProps) {
  const {
    startTime,
    originTimezone,
    dayStartMap,
    freeDaysAfterSegment,
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
  } = useJournalTimeline({ summary, settings, journal, onUpdateJournal });

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Header */}
      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            <h3 className="font-bold text-purple-900">{journal.metadata.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-purple-700">
              {visitedCount}/{totalStops} stops
            </div>
            {visitedCount > 0 && (
              <button
                onClick={resetAllStops}
                title="Reset all stops to re-drive the journey"
                className="text-xs text-purple-400 hover:text-purple-600 transition-colors px-1.5 py-0.5 rounded hover:bg-purple-100"
              >
                ↺ reset
              </button>
            )}
          </div>
        </div>

        {/* Origin badge */}
        {journal.origin && journal.origin.type !== 'manual' && (
          <div className="flex items-center gap-1.5 text-xs mb-3 pb-3 border-b border-purple-100">
            {journal.origin.type === 'challenge' ? (
              <>
                <span>🏁</span>
                <span className="font-semibold text-amber-700">Challenge Run</span>
                <span className="text-purple-400 mx-0.5">—</span>
                <span className="text-purple-700">{journal.origin.title}</span>
              </>
            ) : (
              <>
                <span>🔀</span>
                <span className="font-semibold text-purple-700">Forked from</span>
                <span className="text-purple-900 font-medium">"{journal.origin.title}"</span>
                {journal.origin.author && (
                  <span className="text-purple-500">by {journal.origin.author}</span>
                )}
              </>
            )}
          </div>
        )}

        <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

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
      {currentStop && (
        <QuickArriveButton
          stopName={currentStop.segment.to.name.split(',')[0]}
          onArrive={() => {
            handleUpdateEntry(currentStopIndex, { status: 'visited', actualArrival: new Date() });
            dispatchStopArrived({
              segmentIndex: currentStopIndex,
              toName: currentStop.segment.to.name.split(',')[0],
              toLat: currentStop.segment.to.lat,
              toLng: currentStop.segment.to.lng,
            });
          }}
        />
      )}

      {/* Timeline */}
      <div className="space-y-0 pt-2 relative pb-12">
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
          const segmentCaptures = journal.quickCaptures.filter(qc => qc.autoTaggedSegment === originalIndex);

          return (
            <div key={`stop-${originalIndex}-${flatIndex}`}>
              {dayHeaders.map(({ day, isFirst }) => (
                <DayHeader key={`day-${day.dayNumber}`} day={day} isFirst={isFirst} className="mb-6" />
              ))}

              {/* Inline Add Memory Button */}
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
                          <div className="text-xs text-purple-600 mt-0.5">Captured on the way</div>
                        </div>
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

      {/* Trip Complete — rich recap souvenir */}
      {visitedCount === totalStops && (
        <TripRecapCard
          journal={journal}
          summary={summary}
          settings={settings}
          totalStops={totalStops}
        />
      )}

      {/* Floating Add Memory Button */}
      <button
        onClick={() => handleOpenQuickCapture()}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group"
        title="Add Memory"
      >
        <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
      </button>

      <QuickCaptureDialog
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
        onSave={handleSaveQuickCapture}
        autoTaggedLocation={quickCaptureContext.locationName}
        autoTaggedSegment={quickCaptureContext.segmentIndex}
      />
    </div>
  );
}

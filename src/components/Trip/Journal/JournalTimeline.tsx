import { Camera, Star, BookOpen, Plus, Lock } from 'lucide-react';
import type { TripSettings, TripJournal } from '../../../types';
import { QuickArriveButton } from './QuickArriveButton';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { TripRecapCard } from './TripRecapCard';
import { JournalTimelineBody } from './JournalTimelineBody';
import { useJournalTimeline } from './useJournalTimeline';
import { cn } from '../../../lib/utils';
import { dispatchStopArrived } from '../../../hooks';
import type { JournalTimelineSummary } from '../../../lib/trip-summary-slices';

interface JournalTimelineProps {
  summary: JournalTimelineSummary;
  settings: TripSettings;
  journal: TripJournal;
  onUpdateJournal: (journal: TripJournal) => void;
  className?: string;
  /** When true, the floating purple + button is hidden (e.g. in JournalAtAGlance overlay). */
  hideFloatingAdd?: boolean;
  /** Seal the journal as a read-only souvenir. */
  onFinalize?: () => void;
  /** Abandon the journal mid-trip — skips journaling and returns to itinerary. */
  onAbandonJournal?: () => void;
}

export function JournalTimeline({ summary, settings, journal, onUpdateJournal, className, hideFloatingAdd, onFinalize, onAbandonJournal }: JournalTimelineProps) {
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
    quickCaptureContext,
    editingCapture,
    getEntry,
    handleUpdateEntry,
    handleArriveAtStop,
    handleAddPhoto,
    handleRemovePhoto,
    handleSaveQuickCapture,
    handleOpenQuickCapture,
    handleEditCapture,
    handleDeleteCapture,
    handleQuickCaptureOpenChange,
    formatTime,
    formatDate,
    resetAllStops,
  } = useJournalTimeline({ summary, settings, journal, onUpdateJournal });

  const isFinalized = !!journal.finalized;
  const allVisited = visitedCount === totalStops && totalStops > 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Header */}
      <div className={cn(
        'rounded-xl border-2 p-4',
        isFinalized
          ? 'border-green-200 bg-gradient-to-r from-green-50 to-white'
          : 'border-purple-200 bg-gradient-to-r from-purple-50 to-white',
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isFinalized
              ? <Lock className="h-5 w-5 text-green-600" />
              : <BookOpen className="h-5 w-5 text-purple-600" />
            }
            <h3 className={cn('font-bold', isFinalized ? 'text-green-900' : 'text-purple-900')}>
              {journal.metadata.title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('text-sm font-medium', isFinalized ? 'text-green-700' : 'text-purple-700')}>
              {visitedCount}/{totalStops} stops
            </div>
            {visitedCount > 0 && !isFinalized && (
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

        <div className={cn('h-2 rounded-full overflow-hidden', isFinalized ? 'bg-green-100' : 'bg-purple-100')}>
          <div
            className={cn(
              'h-full transition-all duration-500',
              isFinalized
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : 'bg-gradient-to-r from-purple-500 to-purple-600',
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className={cn('flex items-center gap-4 mt-3 text-xs', isFinalized ? 'text-green-600' : 'text-purple-600')}>
          <span className="flex items-center gap-1">
            <Camera className="h-3 w-3" />
            {journal.stats.photosCount} photos
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {journal.stats.highlightsCount} highlights
          </span>
          {isFinalized && (
            <span className="ml-auto text-green-500 font-medium">Completed</span>
          )}
        </div>
      </div>

      {/* Current Stop - Quick Arrive */}
      {currentStop && !isFinalized && (
        <QuickArriveButton
          stopName={currentStop.segment.to.name.split(',')[0]}
          onArrive={() => {
            handleArriveAtStop(currentStop, { status: 'visited', actualArrival: new Date() });
            dispatchStopArrived({
              segmentIndex: currentStopIndex,
              toName: currentStop.segment.to.name.split(',')[0],
              toLat: currentStop.segment.to.lat,
              toLng: currentStop.segment.to.lng,
            });
          }}
        />
      )}

      {/* Tap to save — shown when all stops visited but journal not yet finalized */}
      {allVisited && !isFinalized && onFinalize && (
        <button
          onClick={onFinalize}
          className={cn(
            'w-full p-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white',
            'flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all',
            'active:scale-[0.98]',
          )}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium opacity-90">All stops visited</div>
            <div className="text-lg font-bold">Tap to save this journal</div>
          </div>
        </button>
      )}

      <JournalTimelineBody
        startTime={startTime}
        originTimezone={originTimezone}
        dayStartMap={dayStartMap}
        freeDaysAfterSegment={freeDaysAfterSegment}
        journalStops={journalStops}
        currentStopIndex={currentStopIndex}
        journal={journal}
        summary={summary}
        isFinalized={isFinalized}
        getEntry={getEntry}
        handleUpdateEntry={handleUpdateEntry}
        handleAddPhoto={handleAddPhoto}
        handleRemovePhoto={handleRemovePhoto}
        handleOpenQuickCapture={handleOpenQuickCapture}
        handleEditCapture={handleEditCapture}
        handleDeleteCapture={handleDeleteCapture}
        formatTime={formatTime}
        formatDate={formatDate}
      />

      {/* Quiet bail-out — lets mid-trip users skip journaling without finishing */}
      {!isFinalized && onAbandonJournal && (
        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <button
            onClick={onAbandonJournal}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: '"DM Mono", monospace',
              fontSize: 11,
              color: 'hsl(var(--muted-foreground) / 0.4)',
              letterSpacing: '0.04em',
            }}
          >
            Not feeling it →
          </button>
        </div>
      )}

      {/* Trip Complete — rich recap souvenir */}
      {visitedCount === totalStops && (
        <TripRecapCard
          journal={journal}
          summary={summary}
          settings={settings}
          totalStops={totalStops}
        />
      )}

      {/* Floating Add Memory Button — hidden when parent provides its own affordance or finalized */}
      {!hideFloatingAdd && !isFinalized && (
        <button
          onClick={() => handleOpenQuickCapture()}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group"
          title="Add Memory"
        >
          <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
        </button>
      )}

      <QuickCaptureDialog
        open={quickCaptureOpen}
        onOpenChange={handleQuickCaptureOpenChange}
        onSave={handleSaveQuickCapture}
        autoTaggedLocation={quickCaptureContext.locationName}
        autoTaggedSegment={quickCaptureContext.segmentIndex}
        initialValues={editingCapture ?? undefined}
      />
    </div>
  );
}

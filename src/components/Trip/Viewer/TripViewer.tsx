import { useState } from 'react';
import { Maximize2, Minimize2, PenLine } from 'lucide-react';
import type { TripJournal } from '../../../types';
import type { ViewMode } from '../Journal/JournalModeToggle';
import type { TripViewerProps } from './viewer-types';
import { Button } from '../../UI/Button';
import { TripTimelineView } from '../TripTimelineView';
import { JournalFullscreenOverlay } from '../Journal/JournalFullscreenOverlay';

function TimelineHeading({
  viewMode,
  activeJournal,
  onExpand,
  onOpenFullscreen,
}: {
  viewMode: ViewMode;
  activeJournal: TripJournal | null;
  onExpand: () => void;
  onOpenFullscreen: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {viewMode === 'journal' ? 'Journal' : 'Itinerary'}
      </h3>
      {viewMode === 'journal' && activeJournal ? (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onOpenFullscreen}
        >
          <PenLine className="h-3 w-3" /> Write
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onExpand}
        >
          <Maximize2 className="h-3 w-3" /> Expand
        </Button>
      )}
    </div>
  );
}

/**
 * TripViewer — the dumb renderer + intent emitter for the trip workspace.
 *
 * Receives canonical trip truth as props, renders the timeline/journal/POI
 * discovery surface, and emits user intents upward via callbacks.
 *
 * Owns only lightweight UI-only state (expand/collapse, journal fullscreen)
 * per the Results Gate architecture spec. Does not own or mutate itinerary truth.
 */
export function TripViewer({
  summary,
  settings,
  vehicle,
  canonicalTimeline,
  viewMode,
  activeJournal,
  activeChallenge,
  tripMode,
  poiSuggestions,
  poiInference,
  isLoadingPOIs,
  poiPartialResults,
  poiFetchFailed,
  externalStops,
  onStartJournal,
  onUpdateJournal,
  onUpdateStopType,
  onUpdateDayNotes,
  onUpdateDayTitle,
  onUpdateDayType,
  onAddDayActivity,
  onUpdateDayActivity,
  onRemoveDayActivity,
  onUpdateOvernight,
  onAddPOI,
  onDismissPOI,
}: TripViewerProps) {
  // Viewer-local UI state — per arch spec, lives here, not in the parent gate
  const [isExpanded, setIsExpanded] = useState(false);
  const [isJournalFullscreen, setIsJournalFullscreen] = useState(false);

  const timeline = (
    <TripTimelineView
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
      onAddDayActivity={onAddDayActivity}
      onUpdateDayActivity={onUpdateDayActivity}
      onRemoveDayActivity={onRemoveDayActivity}
      onUpdateOvernight={onUpdateOvernight}
      poiSuggestions={poiSuggestions}
      poiInference={poiInference}
      isLoadingPOIs={isLoadingPOIs}
      poiPartialResults={poiPartialResults}
      poiFetchFailed={poiFetchFailed}
      onAddPOI={onAddPOI}
      onDismissPOI={onDismissPOI}
      externalStops={externalStops}
    />
  );

  if (isExpanded) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Itinerary</h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setIsExpanded(false)}
          >
            <Minimize2 className="h-3 w-3" /> Collapse
          </Button>
        </div>
        {timeline}
      </div>
    );
  }

  return (
    <>
      {timeline}
      <TimelineHeading
        viewMode={viewMode}
        activeJournal={activeJournal}
        onExpand={() => setIsExpanded(true)}
        onOpenFullscreen={() => setIsJournalFullscreen(true)}
      />
      {isJournalFullscreen && activeJournal && (
        <JournalFullscreenOverlay
          summary={summary}
          settings={settings}
          journal={activeJournal}
          onUpdateJournal={onUpdateJournal}
          onClose={() => setIsJournalFullscreen(false)}
        />
      )}
    </>
  );
}

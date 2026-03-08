import { Maximize2, Minimize2, PenLine } from 'lucide-react';
import type { TripJournal } from '../../types';
import type { ViewMode } from '../Trip/Journal/JournalModeToggle';
import type { Step3TimelineSectionProps } from './step3-types';
import { Button } from '../UI/Button';
import { TripTimelineView } from '../Trip/TripTimelineView';
import { JournalFullscreenOverlay } from '../Trip/Journal/JournalFullscreenOverlay';

interface Props extends Step3TimelineSectionProps {
  isExpanded: boolean;
  isJournalFullscreen: boolean;
  setIsExpanded: (value: boolean) => void;
  setIsJournalFullscreen: (value: boolean) => void;
}

function TimelineHeading({
  viewMode,
  activeJournal,
  setIsExpanded,
  setIsJournalFullscreen,
}: {
  viewMode: ViewMode;
  activeJournal: TripJournal | null;
  setIsExpanded: (value: boolean) => void;
  setIsJournalFullscreen: (value: boolean) => void;
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
          onClick={() => setIsJournalFullscreen(true)}
        >
          <PenLine className="h-3 w-3" /> Write
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(true)}
        >
          <Maximize2 className="h-3 w-3" /> Expand
        </Button>
      )}
    </div>
  );
}

export function Step3TimelineSection({
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
  onUpdateDayNotes,
  onUpdateDayTitle,
  onUpdateDayType,
  onAddDayActivity,
  onUpdateDayActivity,
  onRemoveDayActivity,
  onUpdateOvernight,
  poiSuggestions,
  poiInference,
  isLoadingPOIs,
  poiPartialResults,
  onAddPOI,
  onDismissPOI,
  externalStops,
  isExpanded,
  isJournalFullscreen,
  setIsExpanded,
  setIsJournalFullscreen,
}: Props) {
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
        setIsExpanded={setIsExpanded}
        setIsJournalFullscreen={setIsJournalFullscreen}
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
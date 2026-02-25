/**
 * TripTimelineView — unified timeline switch for plan / itinerary / journal modes.
 *
 * Extracted from Step3Content to eliminate the duplicated SmartTimeline +
 * journal/itinerary branch that appeared in both the normal render and the
 * isExpanded branch. Drop this wherever you need a summary-backed timeline.
 */

import type {
  TripSummary,
  TripSettings,
  Vehicle,
  TripJournal,
  StopType,
  DayType,
  OvernightStop,
  POISuggestion,
  TripChallenge,
  TripMode,
} from '../../types';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { ViewMode } from './JournalModeToggle';
import { SmartTimeline } from './SmartTimeline';
import { JournalTimeline } from './JournalTimeline';
import { ItineraryTimeline } from './ItineraryTimeline';
import { StartJournalCTA } from './JournalModeToggle';

// ==================== PROPS ====================

export interface TripTimelineViewProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  viewMode: ViewMode;

  // Journal
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripMode: TripMode;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;

  // Itinerary callbacks
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;

  // POI
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  onAddPOI: (poiId: string) => void;
  onDismissPOI: (poiId: string) => void;
  externalStops?: SuggestedStop[];
}

// ==================== COMPONENT ====================

export function TripTimelineView({
  summary,
  settings,
  vehicle,
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
  onUpdateOvernight,
  poiSuggestions,
  poiInference,
  isLoadingPOIs,
  onAddPOI,
  onDismissPOI,
  externalStops,
}: TripTimelineViewProps) {
  return (
    <>
      {/* Smart Timeline — time-first view with combo stop optimisation */}
      {viewMode === 'plan' && (
        <SmartTimeline
          summary={summary}
          settings={settings}
          vehicle={vehicle}
          poiSuggestions={poiSuggestions}
          poiInference={poiInference}
        />
      )}

      {/* Journal or Itinerary */}
      {viewMode === 'journal' ? (
        activeJournal ? (
          <JournalTimeline
            summary={summary}
            settings={settings}
            journal={activeJournal}
            onUpdateJournal={onUpdateJournal}
          />
        ) : (
          <StartJournalCTA
            onStart={onStartJournal}
            defaultName={activeChallenge?.title}
            tripMode={tripMode}
          />
        )
      ) : (
        <ItineraryTimeline
          summary={summary}
          settings={settings}
          vehicle={vehicle}
          days={summary.days}
          onUpdateStopType={onUpdateStopType}
          onUpdateDayNotes={onUpdateDayNotes}
          onUpdateDayTitle={onUpdateDayTitle}
          onUpdateDayType={onUpdateDayType}
          onUpdateOvernight={onUpdateOvernight}
          poiSuggestions={poiSuggestions}
          isLoadingPOIs={isLoadingPOIs}
          onAddPOI={onAddPOI}
          onDismissPOI={onDismissPOI}
          externalStops={externalStops}
        />
      )}
    </>
  );
}

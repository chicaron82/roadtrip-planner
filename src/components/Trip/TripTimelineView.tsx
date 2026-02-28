/**
 * TripTimelineView — unified timeline switch for plan / itinerary / journal modes.
 *
 * The Smart Itinerary is the primary view (editable, with inline suggestions).
 * SmartTimeline (simulation view) is available as an optional toggle for power users.
 */

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
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
  poiPartialResults?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
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
  poiPartialResults,
  onAddPOI,
  onDismissPOI,
  externalStops,
}: TripTimelineViewProps) {
  // Toggle for SmartTimeline (simulation view) — hidden by default, available for power users
  const [showSimulation, setShowSimulation] = useState(false);

  return (
    <>
      {/* Simulation View Toggle (plan mode only) */}
      {viewMode === 'plan' && (
        <button
          type="button"
          onClick={() => setShowSimulation(!showSimulation)}
          className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Clock className="h-4 w-4" />
          <span>{showSimulation ? 'Hide' : 'Show'} Simulation View</span>
          {showSimulation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}

      {/* Smart Timeline — time-first simulation view (toggleable) */}
      {viewMode === 'plan' && showSimulation && (
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
          poiPartialResults={poiPartialResults}
          onAddPOI={onAddPOI}
          onDismissPOI={onDismissPOI}
          externalStops={externalStops}
        />
      )}
    </>
  );
}

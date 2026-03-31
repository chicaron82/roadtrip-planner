/**
 * TripTimelineView — unified timeline switch for plan / itinerary / journal modes.
 *
 * The Smart Itinerary is the primary view (editable, with inline suggestions).
 * SmartTimeline (simulation view) is available as an optional toggle for power users.
 */

import { useState, lazy, Suspense } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  TripSettings,
  Vehicle,
  TripJournal,
  StopType,
  DayType,
  OvernightStop,
  POISuggestion,
  TripChallenge,
  TripMode,
  Activity,
} from '../../types';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { CanonicalTripTimeline } from '../../lib/canonical-trip';
import { useTimelineData, type StopOverrides } from './Itinerary/useTimelineData';
import type { ViewMode } from './Journal/JournalModeToggle';
import { ItineraryTimelineContent } from './Itinerary/ItineraryTimeline';
import { StartJournalCTA } from './Journal/JournalModeToggle';
import type { ViewerRouteSummary } from '../../lib/trip-summary-slices';
import { useTripCore } from '../../contexts/TripContext';
import { ItineraryEditProvider, type ItineraryEditCallbacks } from './Itinerary/ItineraryEditContext';

const SmartTimeline = lazy(() => import('./Timeline/SmartTimeline').then(m => ({ default: m.SmartTimeline })));
const JournalTimeline = lazy(() => import('./Journal/JournalTimeline').then(m => ({ default: m.JournalTimeline })));

// ==================== PROPS ====================

export interface TripTimelineViewProps {
  summary: ViewerRouteSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  canonicalTimeline?: CanonicalTripTimeline | null;
  viewMode: ViewMode;

  // Journal
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripMode: TripMode;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  /** Propagated up from ItineraryTimeline — saved back into the journal so overrides survive refresh. */
  onStopOverridesChange?: (overrides: StopOverrides) => void;

  // Itinerary callbacks
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity?: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity?: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onRemoveDayActivity?: (dayNumber: number, activityIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;

  // POI
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  externalStops?: SuggestedStop[];
}

// ==================== COMPONENT ====================

export function TripTimelineView({
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
  onStopOverridesChange,
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
  poiFetchFailed,
  onAddPOI,
  onDismissPOI,
  externalStops,
}: TripTimelineViewProps) {
  // Toggle for SmartTimeline (simulation view) — hidden by default, available for power users
  const [showSimulation, setShowSimulation] = useState(false);
  const { customTitle } = useTripCore();
  const defaultJournalName = activeChallenge?.title ?? customTitle ?? undefined;

  const handleStopOverridesChange = (overrides: StopOverrides) => {
    if (activeJournal) onUpdateJournal({ ...activeJournal, stopOverrides: overrides });
    onStopOverridesChange?.(overrides);
  };

  const itineraryData = useTimelineData({
    summary,
    settings,
    vehicle,
    days: summary.days,
    externalStops,
    initialOverrides: activeJournal?.stopOverrides,
    onStopOverridesChange: handleStopOverridesChange,
  });

  const editCallbacks: ItineraryEditCallbacks = {
    onUpdateStopType,
    onUpdateDayNotes,
    onUpdateDayTitle,
    onUpdateDayType,
    onAddDayActivity,
    onUpdateDayActivity,
    onRemoveDayActivity,
    onUpdateOvernight,
  };

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
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading simulation view...</div>}>
          <SmartTimeline
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            precomputedEvents={canonicalTimeline?.events}
            poiSuggestions={poiSuggestions}
            poiInference={poiInference}
          />
        </Suspense>
      )}

      {/* Journal or Itinerary */}
      {viewMode === 'journal' ? (
        activeJournal ? (
          <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading journal...</div>}>
            <JournalTimeline
              summary={summary}
              settings={settings}
              journal={activeJournal}
              onUpdateJournal={onUpdateJournal}
            />
          </Suspense>
        ) : (
          <StartJournalCTA
            onStart={onStartJournal}
            defaultName={defaultJournalName}
            tripMode={tripMode}
          />
        )
      ) : (
        <ItineraryEditProvider callbacks={editCallbacks}>
          <ItineraryTimelineContent
            summary={summary}
            settings={settings}
            vehicle={vehicle}
            days={summary.days}
            poiSuggestions={poiSuggestions}
            isLoadingPOIs={isLoadingPOIs}
            poiPartialResults={poiPartialResults}
            poiFetchFailed={poiFetchFailed}
            onAddPOI={onAddPOI}
            onDismissPOI={onDismissPOI}
            timelineData={itineraryData}
          />
        </ItineraryEditProvider>
      )}
    </>
  );
}

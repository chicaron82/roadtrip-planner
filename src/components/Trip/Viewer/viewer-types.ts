import type {
  Vehicle, TripSettings, POISuggestion, TripJournal,
  StopType, DayType, OvernightStop, TripMode, TripChallenge, Activity,
} from '../../../types';
import type { CanonicalTripTimeline } from '../../../lib/canonical-trip';
import type { ViewMode } from '../Journal/JournalModeToggle';
import type { SuggestedStop } from '../../../lib/stop-suggestions';
import type { ViewerRouteSummary } from '../../../lib/trip-summary-slices';

/**
 * Props for TripViewer — the dumb renderer + intent emitter surface.
 *
 * Architectural contract (per Results Gate spec):
 *   - Viewer renders what it is given (canonical truth, journal, suggestions)
 *   - Viewer emits user intents upward via callbacks
 *   - Viewer may hold lightweight UI-only state (expand, fullscreen, selected tab)
 *   - Viewer must NOT own itinerary truth, rebuild timeline truth locally,
 *     or make domain decisions about merge/canonical rules
 */
export interface TripViewerProps {
  // Trip data (read-only from canonical source)
  summary: ViewerRouteSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  canonicalTimeline?: CanonicalTripTimeline | null;

  // Display mode
  viewMode: ViewMode;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripMode: TripMode;

  // POI state
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  externalStops?: SuggestedStop[];

  // Journal completion
  isJournalComplete?: boolean;
  showCompleteOverlay?: boolean;
  onConfirmJournalComplete?: () => void;

  // Intent callbacks — viewer emits, upstream controller mutates canonical truth
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity?: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity?: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onRemoveDayActivity?: (dayNumber: number, activityIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
}

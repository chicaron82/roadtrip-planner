import type { Vehicle, TripSettings, TripSummary, POISuggestion, TripJournal, StopType, DayType, OvernightStop, TripMode, TripChallenge } from '../../types';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type { CanonicalTripTimeline } from '../../lib/canonical-trip';
import type { ViewMode } from '../Trip/Journal/JournalModeToggle';

export interface Step3ArrivalInfo {
  dest: string;
  time: string;
  isRoundTrip: boolean;
}

export interface Step3TimelineSectionProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  canonicalTimeline?: CanonicalTripTimeline | null;
  viewMode: ViewMode;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripMode: TripMode;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes?: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle?: (dayNumber: number, title: string) => void;
  onUpdateDayType?: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity?: (dayNumber: number, activity: import('../../types').Activity) => void;
  onUpdateDayActivity?: (dayNumber: number, activityIndex: number, activity: import('../../types').Activity) => void;
  onRemoveDayActivity?: (dayNumber: number, activityIndex: number) => void;
  onUpdateOvernight?: (dayNumber: number, overnight: OvernightStop) => void;
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  externalStops?: SuggestedStop[];
}
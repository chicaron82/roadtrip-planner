import type {
  Activity,
  DayType,
  Location,
  OvernightStop,
  POISuggestion,
  StopType,
  TripChallenge,
  TripJournal,
  TripMode,
  TripSettings,
  TripSummary,
  Vehicle,
} from '../types';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import type { PrintInput } from '../lib/canonical-trip';
import type { TimedEvent } from '../lib/trip-timeline';
import type { FeasibilityResult } from '../lib/feasibility/types';
import type { Step3ArrivalInfo } from '../components/Steps/step3-types';
import type { ViewMode } from '../components/Trip/Journal/JournalModeToggle';
import type { SuggestedStop } from '../lib/stop-suggestions';
import { generateTripOverview } from '../lib/trip-analyzer';
import type { Step3HealthSummary } from '../lib/trip-summary-slices';

export interface Step3HeaderModel {
  hasTrip: boolean;
  printInput?: PrintInput;
  shareUrl: string | null;
  difficulty?: ReturnType<typeof generateTripOverview>['difficulty'] | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripMode?: TripMode;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export interface Step3OvernightPromptModel {
  suggestedLocation: Location;
  hoursBeforeStop: number;
  distanceBeforeStop: number;
  numTravelers: number;
  arrivalTime: string;
  departureTime: string;
  onAccept: () => void;
  onDecline: () => void;
}

export interface Step3HealthModel {
  summary: Step3HealthSummary;
  settings: TripSettings;
  viewMode: ViewMode;
  tripMode: TripMode;
  activeJournal: TripJournal | null;
  tripConfirmed: boolean;
  arrivalInfo: Step3ArrivalInfo | null;
  feasibility: FeasibilityResult | null;
  setViewMode: (mode: ViewMode) => void;
}

export interface Step3ViewerModel {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  canonicalTimeline: CanonicalTripTimeline | null;
  viewMode: ViewMode;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripMode: TripMode;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle: (dayNumber: number, title: string) => void;
  onUpdateDayType: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onRemoveDayActivity: (dayNumber: number, activityIndex: number) => void;
  onUpdateOvernight: (dayNumber: number, overnight: OvernightStop) => void;
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  externalStops?: SuggestedStop[];
}

export interface Step3CommitModel {
  totalDays: number;
  printInput: PrintInput;
  viewMode: ViewMode;
  tripConfirmed: boolean;
  addedStopCount: number;
  shareUrl: string | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripMode?: TripMode;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onSetJournalMode: () => void;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

interface BuildStep3HeaderModelOptions {
  hasTrip: boolean;
  printInput?: PrintInput;
  shareUrl: string | null;
  difficulty?: ReturnType<typeof generateTripOverview>['difficulty'] | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripMode?: TripMode;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export function buildStep3HeaderModel(options: BuildStep3HeaderModelOptions): Step3HeaderModel {
  return options;
}

interface BuildStep3OvernightPromptModelOptions {
  showOvernightPrompt: boolean;
  suggestedOvernightStop: Location | null;
  summary: TripSummary | null;
  numTravelers: number;
  arrivalTime: string;
  departureTime: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function buildStep3OvernightPromptModel({
  showOvernightPrompt,
  suggestedOvernightStop,
  summary,
  numTravelers,
  arrivalTime,
  departureTime,
  onAccept,
  onDecline,
}: BuildStep3OvernightPromptModelOptions): Step3OvernightPromptModel | null {
  if (!showOvernightPrompt || !suggestedOvernightStop || !summary) return null;

  return {
    suggestedLocation: suggestedOvernightStop,
    hoursBeforeStop: (summary.totalDurationMinutes / 60) * 0.5,
    distanceBeforeStop: summary.totalDistanceKm * 0.5,
    numTravelers,
    arrivalTime,
    departureTime,
    onAccept,
    onDecline,
  };
}

interface BuildStep3HealthModelOptions {
  summary: Step3HealthSummary | null;
  settings: TripSettings;
  viewMode: ViewMode;
  tripMode: TripMode;
  activeJournal: TripJournal | null;
  tripConfirmed: boolean;
  arrivalInfo: Step3ArrivalInfo | null;
  feasibility: FeasibilityResult | null;
  setViewMode: (mode: ViewMode) => void;
}

export function buildStep3HealthModel({
  summary,
  settings,
  viewMode,
  tripMode,
  activeJournal,
  tripConfirmed,
  arrivalInfo,
  feasibility,
  setViewMode,
}: BuildStep3HealthModelOptions): Step3HealthModel | null {
  if (!summary) return null;

  return {
    summary,
    settings,
    viewMode,
    tripMode,
    activeJournal,
    tripConfirmed,
    arrivalInfo,
    feasibility,
    setViewMode,
  };
}

interface BuildStep3ViewerModelOptions {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  canonicalTimeline: CanonicalTripTimeline | null;
  viewMode: ViewMode;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripMode: TripMode;
  onStartJournal: (title?: string) => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onUpdateDayNotes: (dayNumber: number, notes: string) => void;
  onUpdateDayTitle: (dayNumber: number, title: string) => void;
  onUpdateDayType: (dayNumber: number, dayType: DayType) => void;
  onAddDayActivity: (dayNumber: number, activity: Activity) => void;
  onUpdateDayActivity: (dayNumber: number, activityIndex: number, activity: Activity) => void;
  onRemoveDayActivity: (dayNumber: number, activityIndex: number) => void;
  onUpdateOvernight: (dayNumber: number, overnight: OvernightStop) => void;
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  isLoadingPOIs: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
  externalStops?: SuggestedStop[];
}

export function buildStep3ViewerModel({
  summary,
  ...rest
}: BuildStep3ViewerModelOptions): Step3ViewerModel | null {
  if (!summary) return null;
  return { summary, ...rest };
}

interface BuildStep3CommitModelOptions {
  printInput?: PrintInput;
  viewMode: ViewMode;
  tripConfirmed: boolean;
  addedStopCount: number;
  shareUrl: string | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  tripMode?: TripMode;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
  onSetJournalMode: () => void;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export function buildStep3CommitModel({
  printInput,
  ...rest
}: BuildStep3CommitModelOptions): Step3CommitModel | null {
  if (!printInput) return null;
  return {
    totalDays: printInput.days.length || 1,
    printInput,
    ...rest,
  };
}
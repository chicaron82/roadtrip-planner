import type {
  Location,
  POISuggestion,
  StopType,
  TripChallenge,
  TripJournal,
  TripMode,
  TripSettings,
  TripSummary,
  Vehicle,
} from '../../types';
import type { TimedEvent } from '../../lib/trip-timeline';
import type { FeasibilityResult } from '../../lib/feasibility/types';
import type { ViewMode } from '../../components/Trip/Journal/JournalModeToggle';
import type { Step3ArrivalInfo } from '../../components/Steps/step3-types';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import type {
  Step3CommitModel,
  Step3HeaderModel,
  Step3HealthModel,
  Step3OvernightPromptModel,
  Step3ViewerModel,
} from './useStep3Models';
import type { generateTripOverview } from '../../lib/trip-analyzer';
import type { TripEstimate } from '../../lib/estimate-service';
import type { SignatureCardModel } from '../../lib/trip-signature-card-model';

export interface UseStep3ControllerOptions {
  summary: TripSummary | null;
  settings: TripSettings;
  vehicle: Vehicle;
  /** All trip locations — used to derive origin/destination for the Signature Card */
  locations: Location[];
  tripMode: TripMode;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeJournal: TripJournal | null;
  activeChallenge?: TripChallenge | null;
  tripConfirmed: boolean;
  addedStopCount: number;
  shareUrl: string | null;
  precomputedEvents?: TimedEvent[];
  isCalculating?: boolean;
  suggestedOvernightStop: Location | null;
  showOvernightPrompt: boolean;
  poiSuggestions: POISuggestion[];
  poiInference?: POISuggestion[];
  externalStops?: SuggestedStop[];
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
  onOpenShareScreen: () => void;
  isJournalComplete?: boolean;
  showCompleteOverlay?: boolean;
  onConfirmJournalComplete?: () => void;
  onStartJournal: (title?: string) => void;
  onSkipJournal?: () => void;
  onAbandonJournal?: () => void;
  onUpdateJournal: (journal: TripJournal) => void;
  onUpdateStopType: (segmentIndex: number, stopType: StopType) => void;
  onDismissOvernight: () => void;
  onConfirmTrip: () => void;
  onUnconfirmTrip: () => void;
}

export interface UseStep3ControllerReturn {
  feasibility: FeasibilityResult | null;
  estimate: TripEstimate | null;
  overview: ReturnType<typeof generateTripOverview> | null;
  arrivalInfo: Step3ArrivalInfo | null;
  overnightTimes: { arrivalTime: string; departureTime: string };
  header: Step3HeaderModel;
  overnightPrompt: Step3OvernightPromptModel | null;
  health: Step3HealthModel | null;
  viewer: Step3ViewerModel | null;
  commit: Step3CommitModel | null;
  /** Signature Card model — null when no trip is calculated yet */
  signatureCard: SignatureCardModel | null;
}

interface BuildStep3ArrivalInfoOptions {
  summary: TripSummary | null;
  precomputedEvents?: TimedEvent[];
  isRoundTrip: boolean;
}

export function buildStep3ArrivalInfo({
  summary,
  precomputedEvents,
  isRoundTrip,
}: BuildStep3ArrivalInfoOptions): Step3ArrivalInfo | null {
  if (!summary) return null;

  const lastSegment = summary.segments.at(-1);
  const canonicalArrival = precomputedEvents?.filter((event) => event.type === 'arrival').at(-1);
  const arrivalTime = canonicalArrival?.arrivalTime
    ?? (lastSegment?.arrivalTime ? new Date(lastSegment.arrivalTime) : null);

  if (!arrivalTime) return null;

  const date = new Date(arrivalTime);
  if (isNaN(date.getTime())) return null;

  const time = date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isRoundTrip && summary.roundTripMidpoint) {
    const destinationSegment = summary.segments[summary.roundTripMidpoint - 1];
    return {
      dest: destinationSegment?.to.name ?? lastSegment?.to.name ?? 'Destination',
      time,
      isRoundTrip: true,
    };
  }

  return {
    dest: lastSegment?.to.name ?? 'Destination',
    time,
    isRoundTrip: false,
  };
}

interface BuildStep3OvernightTimesOptions {
  suggestedOvernightStop: Location | null;
  summary: TripSummary | null;
  departureTime?: string;
}

export function buildStep3OvernightTimes({
  suggestedOvernightStop,
  summary,
  departureTime,
}: BuildStep3OvernightTimesOptions): { arrivalTime: string; departureTime: string } {
  let arrivalTimeValue = '5:00 PM';
  let departureTimeValue = '8:00 AM';

  if (suggestedOvernightStop && summary) {
    const overnightSegment = summary.segments.find((segment) => segment.to.name === suggestedOvernightStop.name);
    if (overnightSegment?.arrivalTime) {
      const date = new Date(overnightSegment.arrivalTime);
      if (!isNaN(date.getTime())) {
        arrivalTimeValue = date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
    }
  }

  if (departureTime) {
    const [hourString, minuteString] = departureTime.split(':');
    const hour = parseInt(hourString, 10);
    const minute = parseInt(minuteString, 10);
    if (!isNaN(hour) && !isNaN(minute)) {
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      departureTimeValue = date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }

  return { arrivalTime: arrivalTimeValue, departureTime: departureTimeValue };
}
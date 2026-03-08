import type { RouteSegment } from '../types';
import type { SuggestedStop } from './stop-suggestions';

export type TimedEventType =
  | 'departure'
  | 'drive'
  | 'fuel'
  | 'meal'
  | 'rest'
  | 'overnight'
  | 'waypoint'
  | 'arrival'
  | 'combo'
  | 'destination';

export interface TimedEvent {
  id: string;
  type: TimedEventType;
  arrivalTime: Date;
  departureTime: Date;
  durationMinutes: number;
  distanceFromOriginKm: number;
  locationHint: string;
  segmentDistanceKm?: number;
  segmentDurationMinutes?: number;
  stops: SuggestedStop[];
  timezone: string;
  timeSavedMinutes?: number;
  comboLabel?: string;
  segment?: RouteSegment;
  flatIndex?: number;
  originalIndex?: number;
}
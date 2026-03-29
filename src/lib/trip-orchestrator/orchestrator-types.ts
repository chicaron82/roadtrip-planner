import type { TripSummary } from '../../types';
import type { StrategicFuelStop } from '../calculations';
import type { SuggestedStop } from '../stop-suggestion-types';
import type { CanonicalTripTimeline } from '../canonical-trip';
import type { JourneyContext } from './journey-context';

/** Thrown for expected failures (no route, validation) — carries user-facing message. */
export class TripCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripCalculationError';
  }
}

export interface TripOrchestrationResult {
  tripSummary: TripSummary;
  canonicalTimeline: CanonicalTripTimeline;
  projectedFuelStops: StrategicFuelStop[];
  smartStops: SuggestedStop[];
  roundTripMidpoint?: number;
  journeyContext: JourneyContext;
}

export interface StopUpdateResult {
  updatedSummary: TripSummary;
  canonicalTimeline: CanonicalTripTimeline;
  projectedFuelStops: StrategicFuelStop[];
}

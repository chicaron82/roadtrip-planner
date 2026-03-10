import type { TripSummary } from '../types';

export type MapRouteDetails = Pick<
  TripSummary,
  'days' | 'segments' | 'totalDistanceKm' | 'totalDurationMinutes'
>;

export type MapInteractionRouteSummary = Pick<
  TripSummary,
  'days' | 'segments' | 'fullGeometry'
>;

export type RoutePlanningSummary = Pick<
  TripSummary,
  'segments' | 'fullGeometry' | 'roundTripMidpoint' | 'totalDurationMinutes'
>;
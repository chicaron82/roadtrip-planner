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

export type Step3HealthSummary = Pick<
  TripSummary,
  'days' | 'totalDurationMinutes' | 'costBreakdown' | 'gasStops'
>;

export type SegmentLookupSummary = Pick<TripSummary, 'segments'>;
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

export type AcceptedItineraryRouteSummary = Pick<
  TripSummary,
  'days' | 'segments' | 'roundTripMidpoint'
>;

export type ViewerRouteSummary = RoutePlanningSummary & AcceptedItineraryRouteSummary & Pick<
  TripSummary,
  'totalDistanceKm' | 'totalFuelCost'
>;

export type Step3HealthSummary = Pick<
  TripSummary,
  'days' | 'totalDurationMinutes' | 'totalDistanceKm' | 'costBreakdown' | 'gasStops'
>;

export type SegmentLookupSummary = Pick<TripSummary, 'segments'>;

export type JournalExportSummary = Pick<
  TripSummary,
  'segments' | 'roundTripMidpoint' | 'costBreakdown' | 'totalFuelCost'
>;

export type PrintCoverSummary = Pick<
  TripSummary,
  'days' | 'totalDistanceKm' | 'totalDurationMinutes' | 'costBreakdown' | 'budgetRemaining'
>;

export type DiscoverySummary = Pick<TripSummary, 'segments' | 'roundTripMidpoint'>;

export type TripHeaderSummaryData = Pick<TripSummary, 'totalDistanceKm' | 'totalFuelCost'>;

export type TripOverviewSummary = Pick<
  TripSummary,
  'days' | 'segments' | 'totalDistanceKm' | 'totalDurationMinutes' | 'gasStops'
>;

export type BudgetSensitivitySummary = Pick<TripSummary, 'costBreakdown'>;

export type FeasibilitySummary = Pick<TripSummary, 'days'>;

export type HoursTradeoffSummary = Pick<TripSummary, 'days' | 'totalDurationMinutes'>;

export type TripRecapSummary = Pick<
  TripSummary,
  'segments' | 'roundTripMidpoint' | 'days' | 'totalDistanceKm' | 'totalFuelCost' | 'costBreakdown'
>;

export type JournalTimelineSummary = RoutePlanningSummary & AcceptedItineraryRouteSummary & TripRecapSummary;
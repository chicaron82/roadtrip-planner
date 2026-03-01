import type { TripSummary, TripSettings, Vehicle } from '../types';
import { generatePacingSuggestions } from './segment-analyzer';
import { findOptimalReturnDeparture } from './return-departure-optimizer';
import { findOptimalOutboundDeparture } from './outbound-departure-optimizer';

interface Params {
  maxDayMinutes: number;
  settings: TripSettings;
  isAlreadySplit: boolean;
  summary: TripSummary;
  vehicle: Vehicle | undefined;
  startTime: Date;
}

/** Pure function: builds the pacing suggestion strings for a trip. */
export function buildPacingSuggestions({
  maxDayMinutes,
  settings,
  isAlreadySplit,
  summary,
  vehicle,
  startTime,
}: Params): string[] {
  const base = generatePacingSuggestions(maxDayMinutes, settings, isAlreadySplit);

  // Check if tweaking the outbound departure would create a Fuel + Lunch combo
  // at a major hub city ~4h out (e.g., depart 8:00 AM → arrive Dryden at noon).
  if (vehicle && summary.fullGeometry?.length > 1) {
    const outboundSegments = summary.roundTripMidpoint != null && summary.roundTripMidpoint > 0
      ? summary.segments.slice(0, summary.roundTripMidpoint)
      : summary.segments;

    const outboundSuggestion = findOptimalOutboundDeparture(
      outboundSegments,
      startTime,
      summary.fullGeometry as number[][],
      vehicle,
      settings,
    );

    if (outboundSuggestion) {
      base.push(
        `⏰ Outbound tip: departing at ${outboundSuggestion.suggestedTime} instead of ${settings.departureTime} would create a Fuel + Lunch combo at ${outboundSuggestion.hubName} around ${outboundSuggestion.arrivalTime}.`
      );
    }
  }

  // For round trips with a vehicle, check if tweaking the return departure
  // would create a Fuel + Lunch combo at a real hub city.
  if (
    summary.roundTripMidpoint != null &&
    summary.roundTripMidpoint > 0 &&
    vehicle &&
    summary.fullGeometry?.length > 1
  ) {
    const returnSegments = summary.segments.slice(summary.roundTripMidpoint);

    const returnStartKm = summary.segments
      .slice(0, summary.roundTripMidpoint)
      .reduce((sum, s) => sum + s.distanceKm, 0);

    const firstReturnSeg = returnSegments[0];
    const returnDeparture: Date =
      firstReturnSeg?.departureTime
        ? new Date(firstReturnSeg.departureTime)
        : new Date(`${settings.departureDate}T${settings.departureTime}`);

    const suggestion = findOptimalReturnDeparture(
      returnSegments,
      returnDeparture,
      summary.fullGeometry as number[][],
      returnStartKm,
      vehicle,
      settings,
    );

    if (suggestion) {
      const direction = suggestion.minutesDelta < 0 ? 'earlier' : 'later';
      const absDelta = Math.abs(suggestion.minutesDelta);
      const deltaStr = absDelta >= 60
        ? `${Math.floor(absDelta / 60)}h${absDelta % 60 > 0 ? ` ${absDelta % 60}min` : ''}`
        : `${absDelta} min`;
      base.push(
        `⏰ Return trip tip: departing ${deltaStr} ${direction} (${suggestion.suggestedTime}) would create a Fuel + Lunch combo stop near ${suggestion.hubName}, saving ~${suggestion.timeSavedMinutes} min.`
      );
    }
  }

  return base;
}

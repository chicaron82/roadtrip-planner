import type { JournalEntry, Location, RouteSegment, Vehicle, TripDay, TripSettings } from '../types';
import type { SuggestedStop } from './stop-suggestion-types';
import type { StopOverrides } from '../components/Trip/timeline-data-types';
import { createStopConfig, generateSmartStops } from './stop-suggestions';
import type { SimulationItem } from './timeline-simulation';
import type { RoutePlanningSummary, SegmentLookupSummary } from './trip-summary-slices';

export interface JournalTimelineStop {
  flatIndex: number;
  originalIndex: number;
  segment: RouteSegment;
}

export function resolveJournalTimelineStop(
  stops: JournalTimelineStop[],
  segmentIndex: number,
): JournalTimelineStop | undefined {
  return stops.find(stop => stop.originalIndex === segmentIndex);
}

export function findJournalEntry(
  entries: JournalEntry[],
  stop: Pick<JournalTimelineStop, 'originalIndex' | 'segment'> | undefined,
): JournalEntry | undefined {
  if (!stop) return undefined;

  const stopId = stop.segment.to.id;
  // When a stop has an ID, match exclusively by stopId. The segmentIndex
  // fallback is unsafe here because splitLongSegments creates sub-segments
  // that share the same _originalIndex — a single check-in entry would
  // falsely match every sub-segment of that original leg.
  if (stopId) return entries.find(entry => entry.stopId === stopId);
  return entries.find(entry => entry.segmentIndex === stop.originalIndex);
}

export function resolveJournalEntryLocation(routeSummary: SegmentLookupSummary, entry: Pick<JournalEntry, 'stopId' | 'segmentIndex'>): Location | undefined {
  return routeSummary.segments.find(segment => segment.to.id === entry.stopId)?.to
    ?? routeSummary.segments[entry.segmentIndex]?.to;
}

export function applyStopOverrides<T extends { id: string; accepted?: boolean; dismissed?: boolean; duration: number }>(
  suggestions: T[],
  overrides?: StopOverrides,
): T[] {
  if (!overrides || Object.keys(overrides).length === 0) return suggestions;

  return suggestions.map(suggestion => {
    const override = overrides[suggestion.id];
    if (!override) return suggestion;
    return {
      ...suggestion,
      accepted: override.accepted ?? suggestion.accepted,
      dismissed: override.dismissed ?? suggestion.dismissed,
      duration: override.duration ?? suggestion.duration,
    };
  });
}

export function buildJournalActiveSuggestions(
  routeSummary: RoutePlanningSummary,
  settings: TripSettings,
  vehicle: Vehicle,
  days: TripDay[] | undefined,
  stopOverrides?: StopOverrides,
): SuggestedStop[] {
  const config = createStopConfig(vehicle, settings, routeSummary.fullGeometry, routeSummary.segments[0]?.from.lng);
  const baseSuggestions = generateSmartStops(routeSummary.segments, config, days);
  const overridden = applyStopOverrides(baseSuggestions, stopOverrides);
  return overridden.filter(suggestion => !suggestion.dismissed);
}

export function buildJournalTimelineStops(simulationItems: SimulationItem[]): JournalTimelineStop[] {
  return simulationItems.flatMap(item => {
    if (item.type !== 'stop' || !item.segment || item.index === undefined) return [];
    // Guard waypoints from border-avoidance routing are normally invisible (they're
    // routing artifacts). Exception: if the guard city is the terminal stop of a
    // driving day (stamped stopType='overnight' by orchestrate-trip.ts), it's a real
    // overnight rest city and must appear as a journal stop.
    if (item.segment.to.id?.startsWith('guard-') && item.segment.stopType !== 'overnight') return [];

    return [{
      flatIndex: item.index,
      originalIndex: item.originalIndex ?? item.index,
      segment: item.segment,
    }];
  });
}
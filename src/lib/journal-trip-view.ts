import type { JournalEntry, Location, TripSummary, Vehicle, TripDay, TripSettings } from '../types';
import type { SuggestedStop } from './stop-suggestion-types';
import type { StopOverrides } from '../components/Trip/timeline-data-types';
import { createStopConfig, generateSmartStops } from './stop-suggestions';

export function resolveJournalEntryLocation(summary: TripSummary, entry: Pick<JournalEntry, 'stopId' | 'segmentIndex'>): Location | undefined {
  return summary.segments.find(segment => segment.to.id === entry.stopId)?.to
    ?? summary.segments[entry.segmentIndex]?.to;
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
  summary: TripSummary,
  settings: TripSettings,
  vehicle: Vehicle,
  days: TripDay[] | undefined,
  stopOverrides?: StopOverrides,
): SuggestedStop[] {
  const config = createStopConfig(vehicle, settings, summary.fullGeometry, summary.segments[0]?.from.lng);
  const baseSuggestions = generateSmartStops(summary.segments, config, days);
  const overridden = applyStopOverrides(baseSuggestions, stopOverrides);
  return overridden.filter(suggestion => !suggestion.dismissed);
}
/**
 * useTripRestore.ts — Restore a past trip from a history snapshot.
 *
 * Current problem: onLoadHistoryTrip calls setSummary directly, which injects
 * a summary fragment without rebuilding locations, settings, or triggering
 * recalculation. The app shows summary data without the rest of the calculation
 * ecosystem (strategy state, journal coupling, etc.).
 *
 * This hook implements Option B (full restore) from the cook-order plan:
 *   - Rebuilds the location list from segment data stored in the summary
 *   - Recalculates the trip so canonical timeline, fuel stops, and POIs
 *     are all freshly computed from the restored route
 *   - Navigates to Step 1 → triggers calculate → lands on Step 3 with
 *     a live computation, not a stale summary fragment
 *
 * Design note: since fullGeometry is stripped before storage, we must
 * recalculate rather than hydrate. This is the honest path.
 *
 * 💚 My Experience Engine
 */

import { useCallback } from 'react';
import type { TripSummary, Location } from '../types';

function extractLocationsFromSummary(summary: TripSummary): Location[] {
  const { segments } = summary;
  if (!segments || segments.length === 0) return [];

  // Build location list from segment endpoints.
  // segments[0].from = origin
  // segments[n].to = destination or waypoint
  // Deduplicate consecutive duplicates (round trips repeat the midpoint).
  const locations: Location[] = [];

  const first = segments[0].from;
  locations.push({
    id: `restored-origin-${Date.now()}`,
    name: first.name,
    lat: first.lat,
    lng: first.lng,
    type: 'origin',
  });

  // Walk segments — collect 'to' locations, collapsing consecutive duplicates
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const prev = locations[locations.length - 1];
    // Skip if same as the last added (round trip return segment ends at origin)
    if (seg.to.lat === prev.lat && seg.to.lng === prev.lng) continue;
    const isLast = i === segments.length - 1;
    locations.push({
      id: `restored-${isLast ? 'dest' : 'wp'}-${i}-${Date.now()}`,
      name: seg.to.name,
      lat: seg.to.lat,
      lng: seg.to.lng,
      type: isLast ? 'destination' : 'waypoint',
    });
  }

  // Ensure at least origin + destination
  if (locations.length < 2) return [];

  // Fix types: last = destination, intermediates = waypoint
  return locations.map((loc, idx) => ({
    ...loc,
    type: idx === 0 ? 'origin' : idx === locations.length - 1 ? 'destination' : 'waypoint',
  }));
}

interface UseTripRestoreOptions {
  setLocations: (locations: Location[]) => void;
  calculateAndDiscover: () => Promise<void>;
  forceStep: (step: 1 | 2 | 3) => void;
  markStepComplete: (step: number) => void;
}

export function useTripRestore({
  setLocations,
  calculateAndDiscover,
  forceStep,
  markStepComplete,
}: UseTripRestoreOptions) {
  /**
   * Restore a past trip from a history TripSummary.
   *
   * Flow:
   * 1. Extract locations from summary.segments
   * 2. Set locations (triggers eager route + Step 1 validation)
   * 3. Mark Step 1 + 2 complete so we can proceed
   * 4. Run calculateAndDiscover() which recalculates the full trip
   *    (the onCalculationComplete callback will forceStep(3))
   */
  const restoreTripSession = useCallback(async (summary: TripSummary): Promise<void> => {
    const locations = extractLocationsFromSummary(summary);
    if (locations.length < 2) {
      console.warn('[restoreTripSession] Could not extract valid locations from summary', summary);
      return;
    }

    setLocations(locations);

    // Step to 1 while locations settle, then mark steps complete and recalculate
    forceStep(1);
    markStepComplete(1);
    markStepComplete(2);

    // Let the location state flush before kicking off calculation
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await calculateAndDiscover();
  }, [setLocations, calculateAndDiscover, forceStep, markStepComplete]);

  return { restoreTripSession };
}

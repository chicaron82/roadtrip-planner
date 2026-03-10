/**
 * useOvernightSnap.ts — Overnight-stop suggestion and background snapping helpers
 *
 * These functions accept React setState callbacks as parameters and belong
 * architecturally adjacent to the hook layer rather than in pure lib/.
 * Extracted from trip-calculation-helpers.ts which should stay reaction-free.
 */

import type { Location, TripSummary, TripDay, TripSettings } from '../types';
import type { CanonicalTripTimeline } from '../lib/canonical-trip';
import { snapOvernightsToTowns } from '../lib/overnight-snapper';
import {
  applySnappedOvernightsToCanonicalTimeline,
  shouldPropagateSnappedOvernightToNextDay,
} from '../lib/trip-calculation-helpers';

/**
 * Shows an overnight-stop suggestion if the trip exceeds maxDriveHours and
 * the day-splitter hasn't already split it into multiple days.
 */
export function checkAndSetOvernightPrompt(
  tripSummary: TripSummary,
  tripDays: TripDay[],
  settings: TripSettings,
  setSuggestedOvernightStop: (loc: Location | null) => void,
  setShowOvernightPrompt: (v: boolean) => void,
): void {
  const totalHours = tripSummary.totalDurationMinutes / 60;
  const exceedsMaxHours = totalHours > settings.maxDriveHours;

  if (exceedsMaxHours && tripDays.length <= 1) {
    const targetDistance = tripSummary.totalDistanceKm * 0.5;
    let currentDist = 0;
    let overnightLocation: Location | null = null;

    for (const segment of tripSummary.segments) {
      currentDist += segment.distanceKm;
      if (currentDist >= targetDistance) {
        overnightLocation = segment.to;
        break;
      }
    }

    if (overnightLocation) {
      setSuggestedOvernightStop(overnightLocation);
      setShowOvernightPrompt(true);
    }
  } else {
    setShowOvernightPrompt(false);
  }
}

/**
 * Async fire-and-forget: snaps transit-split overnight locations to real OSM
 * town centres. Updates summary state once the Overpass query resolves.
 */
export function fireAndForgetOvernightSnap(
  tripDays: TripDay[],
  tripSummary: TripSummary,
  canonicalTimeline: CanonicalTripTimeline | null,
  geocodeController: AbortController,
  setSummary: (s: TripSummary) => void,
  setCanonicalTimeline: (timeline: CanonicalTripTimeline) => void,
): void {
  snapOvernightsToTowns(tripDays, geocodeController.signal)
    .then(snapped => {
      if (geocodeController.signal.aborted || snapped.length === 0) return;

      const enriched = tripDays.map(d => ({ ...d }));
      let changed = false;

      for (const snap of snapped) {
        const idx = enriched.findIndex(d => d.dayNumber === snap.dayNumber);
        if (idx < 0) continue;

        const day = enriched[idx];
        // Preserve the hub-resolved FROM name from simulation (write #2)
        // instead of re-reading raw segment names that may have transit markers.
        const firstFrom = day.route?.split(' \u2192 ')[0] ?? day.segments[0]?.from.name ?? '';
        const clonedSegments = [...day.segments];

        if (clonedSegments.length > 0) {
          const lastSegIdx = clonedSegments.length - 1;
          clonedSegments[lastSegIdx] = {
            ...clonedSegments[lastSegIdx],
            to: {
              ...clonedSegments[lastSegIdx].to,
              lat: snap.lat,
              lng: snap.lng,
              name: snap.name,
            },
          };
        }

        enriched[idx] = {
          ...day,
          route: `${firstFrom} \u2192 ${snap.name}`,
          segments: clonedSegments,
          overnight: {
            ...day.overnight!,
            location: {
              ...day.overnight!.location,
              lat: snap.lat,
              lng: snap.lng,
              name: snap.name,
            },
          },
        };

        // Propagate snapped coords to next day's departure point
        if (idx + 1 < enriched.length) {
          const nextDay = enriched[idx + 1];
          const nextCloned = [...nextDay.segments];
          if (nextCloned.length > 0 && shouldPropagateSnappedOvernightToNextDay(nextDay)) {
            nextCloned[0] = {
              ...nextCloned[0],
              from: {
                ...nextCloned[0].from,
                lat: snap.lat,
                lng: snap.lng,
                name: snap.name,
              },
            };
            // Preserve the hub-resolved TO name from simulation (write #2)
            // instead of re-reading raw segment names.
            const nextLastTo = nextDay.route?.split(' \u2192 ').slice(1).join(' \u2192 ')
              ?? nextCloned[nextCloned.length - 1]?.to.name ?? 'Destination';
            enriched[idx + 1] = {
              ...nextDay,
              route: `${snap.name} \u2192 ${nextLastTo}`,
              segments: nextCloned,
            };
          }
        }

        changed = true;
      }

      if (changed) {
        const updatedSummary = { ...tripSummary, days: enriched };
        setSummary(updatedSummary);
        if (canonicalTimeline) {
          setCanonicalTimeline(
            applySnappedOvernightsToCanonicalTimeline(canonicalTimeline, updatedSummary, snapped),
          );
        }
      }
    })
    .catch((err) => {
      console.warn('[overnight-snap] Overpass unavailable — keeping geometry-interpolated positions', err);
    });
}

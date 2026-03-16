/**
 * trip-print-builders.ts — HTML generation helpers for the print view.
 *
 * These functions produce the raw HTML string injected into the print popup.
 * No React, no DOM — pure string templates.
 *
 * Structure:
 *   Page 1 — cover page (buildCoverPageHTML): route, budget health, warnings, pacing, roster
 *   Page 2+ — day-by-day itinerary (buildDayHTML × N)
 */

import type { DriverRotationResult, DriverStats } from './driver-rotation';
import { computeSwapAssignments } from './driver-rotation';
import type { PrintInput } from './canonical-trip';
import type { TimedEvent } from './trip-timeline';
import type { TripJournal, JournalEntry, QuickCapture } from '../types';
import { buildDayHTML } from './trip-print-day';
import { PRINT_STYLES } from './trip-print-styles';
import { buildCoverPageHTML } from './trip-print-cover';
import { analyzeFeasibility } from './feasibility';

/**
 * Compute per-driver stats that account for mid-segment swaps.
 *
 * assignDrivers() only rotates at flat-segment boundaries. computeSwapAssignments()
 * annotates the itinerary with swap hints at fuel stops, but never feeds back into
 * the roster.  This function bridges that gap:
 *
 *  1. Seeds a stats map from driverRotation.stats (segment-assigned drivers).
 *  2. Collects all fuel/combo events whose stop IDs are in swapSuggestions and
 *     groups them by the segment they fall within (via the next waypoint's flatIndex).
 *  3. Within each segment, sorts swaps by km and computes CONSECUTIVE SPANS:
 *     primary → first swap → second swap → … → end of segment.
 *     This prevents the independent-fraction over-subtraction bug where multiple
 *     swaps each subtract from the primary's full-segment km, collapsing it to 0.
 *
 * If there are no swap suggestions the original stats are returned unchanged.
 */
function computeEnrichedStats(
  driverRotation: DriverRotationResult,
  timedEvents: TimedEvent[],
  swapSuggestions: Record<string, number>,
  numDrivers: number,
): DriverStats[] {
  if (Object.keys(swapSuggestions).length === 0) return driverRotation.stats;

  // Build map: flatIndex → cumulative distanceFromOriginKm at that segment's end.
  // Use the first occurrence (earlier events are more reliable for split segments).
  const segCumKm = new Map<number, number>();
  for (const ev of timedEvents) {
    if (
      (ev.type === 'waypoint' || ev.type === 'arrival' || ev.type === 'destination') &&
      typeof ev.flatIndex === 'number' &&
      !segCumKm.has(ev.flatIndex)
    ) {
      segCumKm.set(ev.flatIndex, ev.distanceFromOriginKm);
    }
  }

  // Derive each segment's start km from its predecessor's end km.
  const sortedFlatIndices = [...segCumKm.keys()].sort((a, b) => a - b);
  const segStartKm = new Map<number, number>();
  for (let i = 0; i < sortedFlatIndices.length; i++) {
    const idx = sortedFlatIndices[i];
    const prev = sortedFlatIndices[i - 1];
    segStartKm.set(idx, prev !== undefined ? (segCumKm.get(prev) ?? 0) : 0);
  }

  // Clone stats for all drivers (including swap drivers who gain stints).
  const statsMap = new Map<number, DriverStats>();
  for (const s of driverRotation.stats) {
    statsMap.set(s.driver, { ...s });
  }
  for (let d = 1; d <= numDrivers; d++) {
    if (!statsMap.has(d)) {
      statsMap.set(d, { driver: d, totalMinutes: 0, totalKm: 0, segmentCount: 0 });
    }
  }

  // Collect all swap points, grouped by the flat segment they fall within.
  interface SwapPoint { swapKm: number; swapDriver: number; }
  const swapsBySegment = new Map<number, SwapPoint[]>();

  for (let i = 0; i < timedEvents.length; i++) {
    const ev = timedEvents[i];
    if (ev.type !== 'fuel' && ev.type !== 'combo') continue;
    const stopId = ev.stops[0]?.id;
    if (!stopId || !(stopId in swapSuggestions)) continue;
    const swapDriver = swapSuggestions[stopId];

    // Find the flatIndex of the segment this fuel stop is within.
    let segIdx: number | undefined;
    for (let j = i + 1; j < timedEvents.length; j++) {
      const next = timedEvents[j];
      if (
        (next.type === 'waypoint' || next.type === 'arrival' || next.type === 'destination') &&
        typeof next.flatIndex === 'number'
      ) {
        segIdx = next.flatIndex;
        break;
      }
    }
    if (segIdx === undefined) continue;

    if (!swapsBySegment.has(segIdx)) swapsBySegment.set(segIdx, []);
    swapsBySegment.get(segIdx)!.push({ swapKm: ev.distanceFromOriginKm, swapDriver });
  }

  // For each segment with swaps, compute consecutive km spans and redistribute.
  for (const [segIdx, swaps] of swapsBySegment) {
    const primaryAssignment = driverRotation.assignments.find(a => a.segmentIndex === segIdx);
    if (!primaryAssignment) continue;
    const primaryDriver = primaryAssignment.driver;

    const sStartKm   = segStartKm.get(segIdx) ?? 0;
    const sEndKm     = segCumKm.get(segIdx) ?? 0;
    const segTotalKm = sEndKm - sStartKm;
    if (segTotalKm <= 0) continue;

    // Sort swaps by km ascending so spans are consecutive
    swaps.sort((a, b) => a.swapKm - b.swapKm);
    // Drop any swap assigned to the primary (shouldn't happen, but guard anyway)
    const validSwaps = swaps.filter(s => s.swapDriver !== primaryDriver);
    if (validSwaps.length === 0) continue;

    const primaryStats = statsMap.get(primaryDriver)!;

    // Compute segment minutes before any redistribution.
    // If primary drove only this one segment, totalMinutes IS segMinutes.
    // Otherwise scale proportionally by km.
    const segMinutes =
      primaryStats.segmentCount === 1
        ? primaryStats.totalMinutes
        : Math.round(
            (segTotalKm / Math.max(1, primaryStats.totalKm)) * primaryStats.totalMinutes,
          );

    // Primary drives from sStartKm to the first swap point.
    const primaryEndKm = validSwaps[0].swapKm;
    const primaryKm    = Math.max(0, Math.round(primaryEndKm - sStartKm));
    const primaryMin   = Math.round((primaryKm / Math.max(1, segTotalKm)) * segMinutes);

    // Transfer: primary loses everything after their span.
    const primaryLostKm  = Math.round(segTotalKm) - primaryKm;
    const primaryLostMin = segMinutes - primaryMin;
    primaryStats.totalKm      = Math.max(0, primaryStats.totalKm - primaryLostKm);
    primaryStats.totalMinutes = Math.max(0, primaryStats.totalMinutes - primaryLostMin);

    // Each swap driver gets their consecutive span.
    for (let k = 0; k < validSwaps.length; k++) {
      const spanStartKm = validSwaps[k].swapKm;
      const spanEndKm   = k + 1 < validSwaps.length ? validSwaps[k + 1].swapKm : sEndKm;
      const spanKm      = Math.max(0, Math.round(spanEndKm - spanStartKm));
      const spanMin     = Math.round((spanKm / Math.max(1, segTotalKm)) * segMinutes);

      const swapStats = statsMap.get(validSwaps[k].swapDriver)!;
      swapStats.totalKm      += spanKm;
      swapStats.totalMinutes += spanMin;
      swapStats.segmentCount += 1;
    }
  }

  return Array.from(statsMap.values()).filter(s => s.segmentCount > 0 || s.totalKm > 0);
}

export function buildPrintHTML(
  tripTitle: string,
  printInput: PrintInput,
  driverRotation: DriverRotationResult | null,
  timedEvents: TimedEvent[],
  journal?: TripJournal,
): string {
  const {
    summary,
    days,
    inputs: { settings, vehicle },
  } = printInput;
  const itineraryDays = days.map(day => day.meta);
  const units = settings.units;
  let runningTripSpend = 0;

  // Compute driver swap suggestions for accepted fuel/combo events.
  // Scan timedEvents in chronological order, resolving each fuel event's segment
  // index by looking forward to the next waypoint's flatIndex (same convention as
  // extractFuelIndicesFromTimedEvents). This lets computeSwapAssignments exclude
  // the current segment's primary driver from the swap pool.
  const fuelEventsForSwap: Array<{ id: string; segmentIndex?: number }> = [];
  if (driverRotation && settings.numDrivers > 1) {
    for (let i = 0; i < timedEvents.length; i++) {
      const ev = timedEvents[i];
      if ((ev.type !== 'fuel' && ev.type !== 'combo') || !ev.stops[0]) continue;
      let segmentIndex: number | undefined;
      for (let j = i + 1; j < timedEvents.length; j++) {
        const next = timedEvents[j];
        if (
          (next.type === 'waypoint' || next.type === 'arrival' || next.type === 'destination') &&
          typeof next.flatIndex === 'number'
        ) {
          segmentIndex = next.flatIndex;
          break;
        }
      }
      fuelEventsForSwap.push({ id: ev.stops[0].id, segmentIndex });
    }
  }

  const swapSuggestions: Record<string, number> =
    driverRotation && settings.numDrivers > 1
      ? computeSwapAssignments(fuelEventsForSwap, driverRotation, settings.numDrivers)
      : {};

  const enrichedStats = driverRotation && settings.numDrivers > 1
    ? computeEnrichedStats(driverRotation, timedEvents, swapSuggestions, settings.numDrivers)
    : undefined;

  const feasibility = analyzeFeasibility(summary, settings);
  const coverHTML = buildCoverPageHTML(
    tripTitle, summary, settings, feasibility, driverRotation, vehicle,
    enrichedStats,
    printInput.subtitle,
    printInput.tripRead,
  );

  const daysHTML = itineraryDays.map(day => {
    runningTripSpend += day.budget.dayTotal;
    const tripBudgetRemaining = settings.budgetMode === 'plan-to-budget' && settings.budget.total > 0
      ? settings.budget.total - runningTripSpend
      : undefined;

    // Collect journal entries for this day.
    // Use stopId as the canonical anchor (per JournalEntry spec); fall back to
    // segmentIndex only for older entries that predate the stopId field.
    const journalEntries: JournalEntry[] = journal
      ? (() => {
          const stopIds = new Set(day.segments.map(seg => seg.to.id).filter(Boolean));
          const segIndices = new Set(day.segmentIndices);
          return journal.entries.filter(e =>
            e.stopId ? stopIds.has(e.stopId) : segIndices.has(e.segmentIndex)
          );
        })()
      : [];
    // Quick captures use autoTaggedSegment (flat index) — no stopId equivalent.
    const quickCaptures: QuickCapture[] = journal
      ? day.segmentIndices.flatMap(si =>
          journal.quickCaptures.filter(qc => qc.autoTaggedSegment === si)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        )
      : [];

    return buildDayHTML(day, settings, driverRotation, units, timedEvents, tripBudgetRemaining, swapSuggestions, settings.driverNames, journalEntries, quickCaptures);
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${tripTitle} — Trip Itinerary</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${coverHTML}
  <h2 class="itinerary-header">📋 Day-by-Day Itinerary</h2>
  ${daysHTML}
  <footer>
    <p>Generated by My Experience Engine • ${new Date().toLocaleDateString()}</p>
  </footer>
</body>
</html>`;
}

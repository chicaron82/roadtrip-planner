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
import { buildDayHTML } from './trip-print-day';
import { PRINT_STYLES } from './trip-print-styles';
import { buildCoverPageHTML } from './trip-print-cover';
import { analyzeFeasibility } from './feasibility';

/**
 * Compute per-driver stats that account for mid-segment swaps.
 *
 * assignDrivers() only rotates at flat-segment boundaries — trips with fewer
 * segments than drivers leave some drivers with zero stats. computeSwapAssignments()
 * annotates the itinerary with swap hints at fuel stops, but never feeds back into
 * the roster.  This function bridges that gap:
 *
 *  1. Seeds a stats map from driverRotation.stats (segment-assigned drivers).
 *  2. For each fuel/combo event whose stop ID is in swapSuggestions, finds the
 *     segment it falls within (via the next waypoint's flatIndex), computes the
 *     km/time fraction driven *after* the swap point, and transfers that portion
 *     from the primary driver to the swap driver.
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

  // Clone stats for all drivers (including unassigned ones who will receive splits).
  const statsMap = new Map<number, DriverStats>();
  for (const s of driverRotation.stats) {
    statsMap.set(s.driver, { ...s });
  }
  for (let d = 1; d <= numDrivers; d++) {
    if (!statsMap.has(d)) {
      statsMap.set(d, { driver: d, totalMinutes: 0, totalKm: 0, segmentCount: 0 });
    }
  }

  // Process each fuel/combo event that carries a mid-segment swap.
  for (let i = 0; i < timedEvents.length; i++) {
    const ev = timedEvents[i];
    if (ev.type !== 'fuel' && ev.type !== 'combo') continue;
    const stopId = ev.stops[0]?.id;
    if (!stopId || !(stopId in swapSuggestions)) continue;
    const swapDriver = swapSuggestions[stopId];

    // The swap happens mid-segment; find the flatIndex of the next waypoint/arrival.
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

    const primaryAssignment = driverRotation.assignments.find(a => a.segmentIndex === segIdx);
    if (!primaryAssignment || primaryAssignment.driver === swapDriver) continue;
    const primaryDriver = primaryAssignment.driver;

    const sStartKm = segStartKm.get(segIdx) ?? 0;
    const sEndKm   = segCumKm.get(segIdx) ?? 0;
    const segTotalKm = sEndKm - sStartKm;
    if (segTotalKm <= 0) continue;

    const kmAfterSwap = Math.max(0, sEndKm - ev.distanceFromOriginKm);
    const fraction    = kmAfterSwap / segTotalKm;

    const primaryStats = statsMap.get(primaryDriver)!;
    const swapStats    = statsMap.get(swapDriver)!;

    // Approximate segment minutes: if the primary driver has only one segment their
    // totalMinutes *is* the segment minutes; otherwise scale proportionally by km.
    const segMinutes = primaryStats.segmentCount === 1
      ? primaryStats.totalMinutes
      : Math.round((segTotalKm / Math.max(1, primaryStats.totalKm)) * primaryStats.totalMinutes);

    const minAfterSwap = Math.round(fraction * segMinutes);
    const kmAfterSwapInt = Math.round(kmAfterSwap);

    primaryStats.totalKm      = Math.max(0, primaryStats.totalKm - kmAfterSwapInt);
    primaryStats.totalMinutes = Math.max(0, primaryStats.totalMinutes - minAfterSwap);

    swapStats.totalKm      += kmAfterSwapInt;
    swapStats.totalMinutes += minAfterSwap;
    swapStats.segmentCount += 1;
  }

  return Array.from(statsMap.values()).filter(s => s.segmentCount > 0 || s.totalKm > 0);
}

export function buildPrintHTML(
  tripTitle: string,
  printInput: PrintInput,
  driverRotation: DriverRotationResult | null,
  timedEvents: TimedEvent[],
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
  // Collect accepted fuel stop references in time order, distribute unassigned
  // drivers round-robin — same logic as the itinerary view's swapSuggestions.
  const swapSuggestions: Record<string, number> =
    driverRotation && settings.numDrivers > 1
      ? computeSwapAssignments(
          timedEvents
            .filter(e => (e.type === 'fuel' || e.type === 'combo') && e.stops[0])
            .sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime())
            .map(e => ({ id: e.stops[0].id })),
          driverRotation,
          settings.numDrivers,
        )
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
    return buildDayHTML(day, settings, driverRotation, units, timedEvents, tripBudgetRemaining, swapSuggestions, settings.driverNames);
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

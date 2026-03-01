/**
 * Trip Print View
 *
 * Renders a clean, print-optimized version of the trip itinerary.
 * Uses window.print() with a dedicated print container — no external dependencies.
 *
 * HTML generation: trip-print-builders.ts
 * CSS:             trip-print-styles.ts
 */

import type { TripSummary, TripSettings, Vehicle } from '../../types';
import type { DriverRotationResult } from '../../lib/driver-rotation';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import { assignDrivers } from '../../lib/driver-rotation';
import { showToast } from '../../lib/toast';
import { generateSmartStops, createStopConfig } from '../../lib/stop-suggestions';
import { buildTimedTimeline, type TimedEvent } from '../../lib/trip-timeline';
import { applyComboOptimization } from '../../lib/stop-consolidator';
import { buildPrintHTML } from '../../lib/trip-print-builders';

// ==================== TYPES ====================

interface TripPrintViewProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  /** When provided, use these instead of regenerating from scratch.
   *  This is the single-source-of-truth link: the main UI computes
   *  suggestions (with user accept/dismiss state), and the PDF
   *  renders exactly what the user sees. */
  activeSuggestions?: SuggestedStop[];
}


export function printTrip(props: TripPrintViewProps): void {
  const { summary, settings, vehicle } = props;
  const days = summary.days || [];

  // Compute driver rotation (same logic as ItineraryTimeline)
  let driverRotation: DriverRotationResult | null = null;
  if (settings.numDrivers > 1) {
    // We need simulationItems to extract fuel indices, but for print we can use segment stopTypes directly
    const fuelIndices = summary.segments
      .map((seg, i) => seg.stopType === 'fuel' ? i : -1)
      .filter(i => i >= 0);
    driverRotation = assignDrivers(summary.segments, settings.numDrivers, fuelIndices);
  }

  // Build timed events — use caller's suggestions when available (single source of truth),
  // otherwise regenerate fresh (backwards compatible for callers that don't pass suggestions).
  let timedEvents: TimedEvent[] = [];
  if (vehicle) {
    const allSuggestions = props.activeSuggestions
      ?? generateSmartStops(
        summary.segments,
        createStopConfig(vehicle, settings, summary.fullGeometry),
        summary.days,
      );
    const raw = buildTimedTimeline(
      summary.segments,
      allSuggestions,
      settings,
      summary.roundTripMidpoint,
      (settings.dayTripDurationHours ?? 0) * 60,
      summary.days,
    );
    timedEvents = applyComboOptimization(raw);
  }

  const origin = summary.segments[0]?.from.name || 'Origin';
  const destination = summary.segments[summary.segments.length - 1]?.to.name || 'Destination';
  const tripTitle = `${origin} → ${destination}`;

  const html = buildPrintHTML(tripTitle, summary, settings, days, driverRotation, timedEvents);

  // Open print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    showToast({ message: "Popups are blocked — allow them in your browser settings to print.", type: 'warning', duration: 5000 });
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to render, then print
  printWindow.onload = () => {
    printWindow.print();
  };
}


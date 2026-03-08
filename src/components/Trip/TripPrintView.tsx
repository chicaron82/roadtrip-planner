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
import { assignDrivers } from '../../lib/driver-rotation';
import { showToast } from '../../lib/toast';
import { type TimedEvent } from '../../lib/trip-timeline';
import { buildPrintHTML } from '../../lib/trip-print-builders';

// ==================== TYPES ====================

interface TripPrintViewProps {
  summary: TripSummary;
  settings: TripSettings;
  vehicle?: Vehicle;
  /** Canonical timed events from the main trip calculation.
   *  Print must render from the same timeline the UI uses. */
  precomputedEvents: TimedEvent[];
}


export function printTrip(props: TripPrintViewProps): void {
  const { summary, settings } = props;
  const days = summary.days || [];

  if (!props.precomputedEvents.length) {
    showToast({
      message: 'Print is unavailable until the trip timeline is ready.',
      type: 'warning',
      duration: 4000,
    });
    return;
  }

  let driverRotation: DriverRotationResult | null = null;
  if (settings.numDrivers > 1) {
    const flatSegments: typeof summary.segments = [];
    if (days && days.length > 0) {
      days.forEach(day => {
        if (day.segmentIndices.length > 0) {
          flatSegments.push(...day.segments);
        }
      });
    } else {
      flatSegments.push(...summary.segments);
    }
    
    // We need simulationItems to extract fuel indices, but for print we can use segment stopTypes directly
    const fuelIndices = flatSegments
      .map((seg, i) => seg.stopType === 'fuel' ? i : -1)
      .filter(i => i >= 0);
    driverRotation = assignDrivers(flatSegments, settings.numDrivers, fuelIndices);
  }

  const timedEvents = props.precomputedEvents;

  const origin = summary.segments[0]?.from.name || 'Origin';
  // For round trips: title should reflect the primary destination (where you went),
  // not the final endpoint (which loops back to origin — produces "Dryden → Dryden").
  // Use the segment at roundTripMidpoint as the turnaround city.
  const midSeg = summary.roundTripMidpoint != null
    ? summary.segments[summary.roundTripMidpoint - 1]
    : null;
  const destination = midSeg?.to.name
    || summary.segments[summary.segments.length - 1]?.to.name
    || 'Destination';
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


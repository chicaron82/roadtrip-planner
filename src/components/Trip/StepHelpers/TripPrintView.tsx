/**
 * Trip Print View
 *
 * Renders a clean, print-optimized version of the trip itinerary.
 * Uses window.print() with a dedicated print container — no external dependencies.
 *
 * HTML generation: trip-print-builders.ts
 * CSS:             trip-print-styles.ts
 */

import type { TripSummary, TripSettings, Vehicle } from '../../../types';
import type { DriverRotationResult } from '../../../lib/driver-rotation';
import { assignDrivers, extractFuelIndicesFromTimedEvents } from '../../../lib/driver-rotation';
import { showToast } from '../../../lib/toast';
import { type TimedEvent } from '../../../lib/trip-timeline';
import { buildPrintHTML } from '../../../lib/trip-print-builders';
import { getTripDisplayEndpoints } from '../../../lib/trip-summary-view';

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
    
    // Use precomputed timed events (same source the itinerary view uses) to locate
    // fuel stop flat-segment indices. The previous approach read seg.stopType === 'fuel'
    // which is a user-set waypoint field — auto-generated simulation stops never set it,
    // so rotation always fell back to time-based and hit the flat-segment ceiling.
    const fuelIndices = extractFuelIndicesFromTimedEvents(props.precomputedEvents);
    driverRotation = assignDrivers(flatSegments, settings.numDrivers, fuelIndices);
  }

  const timedEvents = props.precomputedEvents;

  const endpoints = getTripDisplayEndpoints(summary);
  const origin = endpoints.origin?.name || 'Origin';
  const destination = endpoints.destination?.name || 'Destination';
  const tripTitle = `${origin} → ${destination}`;

  const html = buildPrintHTML(tripTitle, summary, settings, days, driverRotation, timedEvents, props.vehicle);

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


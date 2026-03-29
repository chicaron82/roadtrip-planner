/**
 * Trip Print View
 *
 * Renders a clean, print-optimized version of the trip itinerary.
 * Uses window.print() with a dedicated print container — no external dependencies.
 *
 * HTML generation: trip-print-builders.ts
 * CSS:             trip-print-styles.ts
 */

import type { DriverRotationResult } from '../../../lib/driver-rotation';
import { assignDrivers, extractFuelIndicesFromTimedEvents } from '../../../lib/driver-rotation';
import { showToast } from '../../../lib/toast';
import { type TimedEvent } from '../../../lib/trip-timeline';
import type { PrintInput } from '../../../lib/canonical-trip';
import { buildPrintHTML } from '../../../lib/trip-print-builders';
import { getTripDisplayEndpoints } from '../../../lib/trip-summary-view';
import { buildSeededTitle } from '../../../lib/trip-title-seeds';
import type { TripJournal } from '../../../types';

// ==================== TYPES ====================

export interface TripPrintViewProps {
  printInput: PrintInput;
  /** Canonical timed events from the main trip calculation.
   *  Print must render from the same timeline the UI uses. */
  precomputedEvents: TimedEvent[];
  /** Active journal — when present, photos/notes are woven into each day's output. */
  journal?: TripJournal;
}


export function printTrip(props: TripPrintViewProps): void {
  const {
    printInput,
    precomputedEvents,
    journal,
  } = props;
  const {
    summary,
    days,
    inputs: { settings },
  } = printInput;

  if (!precomputedEvents.length) {
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
        if (day.meta.segmentIndices.length > 0) {
          flatSegments.push(...day.meta.segments);
        }
      });
    } else {
      flatSegments.push(...summary.segments);
    }
    
    // Use precomputed timed events (same source the itinerary view uses) to locate
    // fuel stop flat-segment indices. The previous approach read seg.stopType === 'fuel'
    // which is a user-set waypoint field — auto-generated simulation stops never set it,
    // so rotation always fell back to time-based and hit the flat-segment ceiling.
    const fuelIndices = extractFuelIndicesFromTimedEvents(precomputedEvents);

    // Day-boundary rotation: when no fuel stops exist, rotate drivers at day boundaries
    // rather than by accumulated drive time. Time-based splitting is fragile — OSRM
    // returns slightly asymmetric durations (e.g. 127+128 min round trip), causing the
    // accumulated total to land just under primaryShare and skipping the rotation entirely.
    // Day boundaries are the natural human swap point: "you drove today, I drive tomorrow."
    const rotationIndices = fuelIndices.length > 0
      ? fuelIndices
      : (() => {
          if (!days || days.length === 0) return [];
          const drivingDays = days.filter(d => d.meta.segmentIndices.length > 0);
          const dayBoundary: number[] = [];
          let flatIdx = 0;
          drivingDays.forEach((day, di) => {
            if (di > 0 && flatIdx > 0) {
              // rotationSet uses "after segment i" semantics: add flatIdx-1 so the
              // driver changes at the first segment of the new day (flatIdx).
              dayBoundary.push(flatIdx - 1);
            }
            flatIdx += day.meta.segments.length;
          });
          return dayBoundary;
        })();

    driverRotation = assignDrivers(flatSegments, settings.numDrivers, rotationIndices);
  }

  const timedEvents = precomputedEvents;

  const endpoints = getTripDisplayEndpoints(summary);
  const destination = endpoints.destination?.name || 'Destination';
  const tripTitle = printInput.customTitle
    ?? buildSeededTitle({ destination, days: summary.drivingDays, travelerCount: settings.numTravelers ?? 1 });

  const html = buildPrintHTML(
    tripTitle,
    printInput,
    driverRotation,
    timedEvents,
    journal,
  );

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


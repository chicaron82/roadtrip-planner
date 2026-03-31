import type { TripDay, TripSettings, JournalEntry, QuickCapture } from '../types';
import type { DriverRotationResult } from './driver-rotation';
import type { TimedEvent } from './trip-timeline-types';
import { formatDriveTime, getDriverName } from './driver-rotation';
import { formatTime } from './trip-timeline';
import { formatDateInZone, lngToIANA } from './trip-timezone';
import {
  formatDistance,
  formatTimeFromISO,
  getDriverForSegment,
} from './trip-print-formatters';
import { buildEventHTML, buildSegmentHTML } from './trip-print-event';
import { buildHotelHTML } from './trip-print-hotel';
import { buildJournalHTML } from './trip-print-journal';
import { buildBudgetHTML } from './trip-print-budget';

// ── Private helpers ──────────────────────────────────────────────────────────

function cleanRouteEndpoint(name?: string): string {
  if (!name) return '';
  const cleaned = name.replace(/\s*\(transit\)\s*$/, '');
  return cleaned.includes(' → ') ? cleaned.split(' → ').pop()!.trim() : cleaned.trim();
}

function resolveDayRouteLabel(
  day: TripDay,
  dayType: 'planned' | 'flexible' | 'free',
  departureEvent?: TimedEvent,
  arrivalEvent?: TimedEvent,
  destinationEvent?: TimedEvent,
): string {
  if (departureEvent && destinationEvent) {
    const routeParts = [departureEvent.locationHint, destinationEvent.locationHint];
    if (arrivalEvent?.locationHint && arrivalEvent.locationHint !== destinationEvent.locationHint) {
      routeParts.push(arrivalEvent.locationHint);
    }
    return routeParts.join(' → ');
  }

  if (day.route) return day.route;
  if (dayType === 'free') return 'Free Day';
  if (dayType === 'flexible') return 'Flexible Day';

  const from = day.overnight?.location.name ?? day.segments[0]?.from.name;
  const to = cleanRouteEndpoint(day.segments.at(-1)?.to.name);
  if (from && to) return `${from} → ${to}`;
  return '—';
}

function normalizeDayEvents(day: TripDay, dayEvents: TimedEvent[]): TimedEvent[] {
  const routeFrom = day.route.split(' → ')[0]?.trim();
  const overnightName = day.overnight?.location.name?.trim();
  const arrivalName = cleanRouteEndpoint(day.segments.at(-1)?.to.name);

  return dayEvents.map(event => {
    if (event.type === 'departure' && routeFrom) {
      return { ...event, locationHint: routeFrom };
    }
    if (event.type === 'overnight' && overnightName) {
      return { ...event, locationHint: overnightName };
    }
    if (event.type === 'arrival' && arrivalName) {
      return { ...event, locationHint: arrivalName };
    }
    return event;
  });
}

// ── Day HTML builder ─────────────────────────────────────────────────────────

export function buildDayHTML(
  day: TripDay,
  settings: TripSettings,
  driverRotation: DriverRotationResult | null,
  units: 'metric' | 'imperial',
  timedEvents: TimedEvent[],
  tripBudgetRemaining?: number,
  swapSuggestions?: Record<string, number>,
  driverNames?: string[],
  journalEntries?: JournalEntry[],
  quickCaptures?: QuickCapture[],
): string {
  const dayType = day.dayType || 'planned';
  const departureMs = day.totals.departureTime ? new Date(day.totals.departureTime).getTime() : null;
  const arrivalMs = day.totals.arrivalTime ? new Date(day.totals.arrivalTime).getTime() : null;
  const isMultiDayDrive = departureMs !== null && arrivalMs !== null && arrivalMs - departureMs > 24 * 3600 * 1000;

  const dayEvents = dayType === 'planned' && timedEvents.length > 0
    ? timedEvents.filter(event => {
        if (isMultiDayDrive && departureMs !== null && arrivalMs !== null) {
          const eventMs = event.arrivalTime.getTime();
          return eventMs >= departureMs - 60_000 && eventMs <= arrivalMs + 60_000;
        }
        const matchesDate = formatDateInZone(event.arrivalTime, event.timezone ?? 'UTC') === day.date;
        if (matchesDate && departureMs !== null) {
          return event.arrivalTime.getTime() >= departureMs - 60_000;
        }
        return matchesDate;
      })
    : [];
  const normalizedDayEvents = normalizeDayEvents(day, dayEvents);
  const departureEvent = normalizedDayEvents.find(event => event.type === 'departure');
  const arrivalEvent = normalizedDayEvents.find(event => event.type === 'overnight' || event.type === 'arrival');
  const destinationEvent = normalizedDayEvents.find(event => event.type === 'destination');

  const hotelHTML = day.overnight ? buildHotelHTML(day) : '';

  // Map drive-event index (0 = first segment in this day) → timezone banner HTML.
  // Banners are injected inline after the corresponding drive event rather than
  // dumped as a block above the whole timeline.
  const tzAfterDriveIndex = new Map<number, string>(
    day.timezoneChanges.map(c => [
      c.afterSegmentIndex,
      `<div class="tz-alert">⏰ ${c.message}</div>`,
    ])
  );

  // Determine the driver taking the wheel at the start of this day (for departure annotation).
  const initialDriverName: string | undefined = (() => {
    if (!driverRotation || settings.numDrivers <= 1 || day.segmentIndices.length === 0) return undefined;
    const driver = getDriverForSegment(day.segmentIndices[0], driverRotation);
    return driver ? getDriverName(driver, driverNames) : undefined;
  })();

  let timelineHTML = '';
  if (normalizedDayEvents.length > 0) {
    let driveEventCount = 0;
    timelineHTML = normalizedDayEvents.map((event, index) => {
      let swapDriverName: string | undefined;
      if (swapSuggestions && (event.type === 'fuel' || event.type === 'combo')) {
        const stopId = event.stops?.[0]?.id;
        const driverNum = stopId != null ? swapSuggestions[stopId] : undefined;
        if (driverNum != null) swapDriverName = getDriverName(driverNum, driverNames);
      }
      const html = buildEventHTML(
        event, units, index === 0, swapDriverName,
        event.type === 'departure' ? initialDriverName : undefined,
      );
      if (event.type === 'drive') {
        const tzBanner = tzAfterDriveIndex.get(driveEventCount) ?? '';
        driveEventCount++;
        return html + tzBanner;
      }
      return html;
    }).join('');
  } else if (dayType === 'planned' && day.segments.length > 0) {
    timelineHTML = day.segments.map((segment, index) => {
      const globalIndex = day.segmentIndices[index];
      const driver = getDriverForSegment(globalIndex, driverRotation);
      const driverName = driver ? getDriverName(driver, settings.driverNames) : undefined;
      return buildSegmentHTML(segment, driverName, units, index === 0);
    }).join('');
  }

  let specialContent = '';
  if (dayType === 'free') {
    specialContent = '<div class="free-day">🌴 Free Day — No planned driving</div>';
  } else if (dayType === 'flexible' && day.options?.length) {
    const selected = day.selectedOption !== undefined ? day.options[day.selectedOption] : null;
    specialContent = `
      <div class="flexible-day">
        🔀 Flexible Day
        ${selected ? `— Selected: <strong>${selected.name}</strong>` : '— Options available'}
      </div>
    `;
  }

  const notesHTML = day.notes ? `<div class="day-notes">📝 ${day.notes}</div>` : '';
  const journalHTML = buildJournalHTML(journalEntries, quickCaptures);
  const budgetHTML = buildBudgetHTML(day, tripBudgetRemaining);

  const departureTimezone = day.segments[0]?.from.lng != null ? lngToIANA(day.segments[0].from.lng) : undefined;
  const departureTimeStr = departureEvent
    ? formatTime(departureEvent.arrivalTime, departureEvent.timezone)
    : formatTimeFromISO(day.totals.departureTime, departureTimezone);
  const arrivalTimeStr = arrivalEvent
    ? formatTime(arrivalEvent.arrivalTime, arrivalEvent.timezone)
    : formatTimeFromISO(day.totals.arrivalTime, departureTimezone);
  const sameTime = departureTimeStr === arrivalTimeStr;

  const routeLabel = resolveDayRouteLabel(day, dayType, departureEvent, arrivalEvent, destinationEvent);

  const statsLine = dayType !== 'free'
    ? `${formatDistance(day.totals.distanceKm, units)} •
       ${formatDriveTime(day.totals.driveTimeMinutes)} driving •
       Departure: ${departureTimeStr}${sameTime ? '' : ` • Arrival: ${arrivalTimeStr}`}`
    : 'Rest day — no driving';

  const dateLabel = (() => {
    if (!isMultiDayDrive || !arrivalMs) return day.dateFormatted;
    const arrivalDate = new Date(arrivalMs);
    const arrivalFormatted = arrivalDate.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    return `${day.dateFormatted} – ${arrivalFormatted}`;
  })();

  return `
    <div class="day-section">
      <div class="day-header">
        <h2>🗓️ Day ${day.dayNumber} — ${dateLabel}</h2>
        ${day.title ? `<div class="day-title">🚗 ${day.title}</div>` : ''}
        <div class="day-route">Route: ${routeLabel}</div>
        <div class="day-stats">${statsLine}</div>
      </div>
      ${hotelHTML}
      ${specialContent}
      ${timelineHTML}
      ${notesHTML}
      ${journalHTML}
      ${budgetHTML}
    </div>
  `;
}

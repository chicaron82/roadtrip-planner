import type { TripDay, TripSettings, RouteSegment, JournalEntry, QuickCapture } from '../types';
import type { DriverRotationResult } from './driver-rotation';
import type { TimedEvent } from './trip-timeline-types';
import { formatDriveTime, getDriverName } from './driver-rotation';
import { formatTime, formatDuration } from './trip-timeline';
import { formatDateInZone, lngToIANA } from './trip-timezone';
import { escapeHtml } from './utils';
import {
  formatCurrency,
  formatDistance,
  formatTimeFromISO,
  getActivityEmoji,
  getDriverForSegment,
  getEventEmoji,
  getEventLabel,
  getWeatherEmoji,
} from './trip-print-formatters';

// ── Event HTML builder ───────────────────────────────────────────────────────

export function buildEventHTML(
  event: TimedEvent,
  units: 'metric' | 'imperial',
  isFirst: boolean,
  swapDriverName?: string,
  initialDriverName?: string,
): string {
  const emoji = getEventEmoji(event.type);
  const label = getEventLabel(event);

  if (event.type === 'drive') {
    const km = event.segmentDistanceKm ?? 0;
    const min = event.segmentDurationMinutes ?? 0;
    return `
      <div class="drive-connector">
        <span class="drive-arrow">↓</span>
        <span class="drive-info">${formatDuration(min)} · ${formatDistance(km, units)}</span>
      </div>
    `;
  }

  if (event.type === 'waypoint') return '';

  if (event.type === 'departure' || event.type === 'arrival') {
    return `
      <div class="event ${event.type} ${isFirst ? 'first-event' : ''}">
        <div class="event-time">${formatTime(event.arrivalTime, event.timezone)}</div>
        <div class="event-body">
          <span class="event-emoji">${emoji}</span>
          <strong>${label}</strong>
          <span class="event-location">${event.locationHint}</span>
          ${initialDriverName ? `<div class="driver-annotation">🚗 ${initialDriverName} driving</div>` : ''}
        </div>
      </div>
    `;
  }

  const showDepart = event.type !== 'overnight';
  return `
    <div class="event stop-event ${event.type} ${isFirst ? 'first-event' : ''}">
      <div class="event-time">${formatTime(event.arrivalTime, event.timezone)}</div>
      <div class="event-body">
        <div class="event-header">
          <span class="event-emoji">${emoji}</span>
          <strong>${label}</strong>
          ${event.type !== 'destination' ? `<span class="event-location">${event.locationHint}</span>` : ''}
        </div>
        <div class="event-timing">
          Arrive ${formatTime(event.arrivalTime, event.timezone)} · ${formatDuration(event.durationMinutes)}${showDepart ? ` · Depart ${formatTime(event.departureTime, event.timezone)}` : ''}
        </div>
        ${swapDriverName ? `<div class="swap-annotation">🔁 Driver swap — ${swapDriverName}</div>` : ''}
      </div>
    </div>
  `;
}

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

// ── Segment HTML builder (legacy fallback) ──────────────────────────────────

export function buildSegmentHTML(
  segment: RouteSegment,
  driverName: string | undefined,
  units: 'metric' | 'imperial',
  isFirst: boolean,
): string {
  const time = segment.arrivalTime ? formatTimeFromISO(segment.arrivalTime) : '';
  const isFuelStop = segment.stopType === 'fuel';
  const isOvernight = segment.stopType === 'overnight';

  const activityHTML = segment.activity
    ? `<span class="activity">${getActivityEmoji(segment.activity.category)} ${segment.activity.name}${segment.activity.durationMinutes ? ` (${segment.activity.durationMinutes} min)` : ''}</span>`
    : '';

  const weatherHTML = segment.weather
    ? `<span class="weather">${getWeatherEmoji(segment.weather)} ${segment.weather.temperatureMax}°C, ${segment.weather.precipitationProb}% rain</span>`
    : '';

  let stopLabel = '';
  if (isFuelStop) stopLabel = '🔁 Fuel Stop';
  else if (isOvernight) stopLabel = '🏨 Overnight';
  else if (segment.stopType === 'meal') stopLabel = '🍽️ Meal';
  else if (segment.stopType === 'break') stopLabel = '☕ Break';

  const driverLabel = driverName ? ` [${driverName}]` : '';

  return `
    <div class="segment ${isFuelStop ? 'fuel-stop' : ''} ${isFirst ? 'first-segment' : ''}">
      <div class="seg-time">${time}</div>
      <div class="seg-body">
        <strong>${segment.to.name}</strong>
        <span class="seg-stats">${formatDistance(segment.distanceKm, units)} • ${formatDriveTime(segment.durationMinutes)} • ${formatCurrency(segment.fuelCost)} fuel${driverLabel}</span>
        ${stopLabel ? `<span class="seg-stop">${stopLabel}${segment.stopDuration ? ` (${segment.stopDuration} min)` : ''}</span>` : ''}
        ${activityHTML}
        ${weatherHTML}
      </div>
    </div>
  `;
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

function buildJournalHTML(entries?: JournalEntry[], captures?: QuickCapture[]): string {
  const hasEntries = entries && entries.some(e => e.notes || e.photos.length > 0);
  const hasCaptures = captures && captures.length > 0;
  if (!hasEntries && !hasCaptures) return '';

  const parts: string[] = [];

  if (hasEntries) {
    for (const entry of entries!) {
      if (!entry.notes && entry.photos.length === 0) continue;
      const photosHTML = entry.photos.length > 0
        ? `<div class="journal-photos">${entry.photos.map(p => `
            <figure class="journal-photo">
              <img src="${p.dataUrl}" alt="${escapeHtml(p.caption || '')}" />
              ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
            </figure>`).join('')}</div>`
        : '';
      const ratingHTML = entry.rating ? `<span class="journal-rating">${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}</span>` : '';
      parts.push(`
        <div class="journal-entry">
          ${ratingHTML}
          ${entry.notes ? `<p class="journal-notes">${escapeHtml(entry.notes)}</p>` : ''}
          ${photosHTML}
        </div>`);
    }
  }

  if (hasCaptures) {
    const captureItems = captures!.map(qc => {
      const timeStr = new Date(qc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const photoHTML = qc.photo
        ? `<figure class="journal-photo capture-photo">
            <img src="${qc.photo.dataUrl}" alt="${escapeHtml(qc.photo.caption || '')}" />
            ${qc.photo.caption ? `<figcaption>${escapeHtml(qc.photo.caption)}</figcaption>` : ''}
           </figure>`
        : '';
      const location = qc.autoTaggedLocation ? ` · ${escapeHtml(qc.autoTaggedLocation)}` : '';
      return `<div class="capture-item">${photoHTML}<span class="capture-time">${timeStr}${location}</span></div>`;
    }).join('');
    parts.push(`<div class="journal-captures">${captureItems}</div>`);
  }

  return `<div class="journal-section"><div class="journal-section-label">📔 Journal</div>${parts.join('')}</div>`;
}

function buildHotelHTML(day: TripDay): string {
  const overnight = day.overnight;
  if (!overnight) return '';

  return `
    <div class="hotel-card">
      <div class="hotel-name">🔑 ${overnight.hotelName || 'Overnight Stay'}</div>
      ${overnight.address ? `<div class="hotel-detail">📍 ${overnight.address}</div>` : ''}
      <div class="hotel-detail">
        💵 ${formatCurrency(overnight.cost)}
        ${overnight.roomsNeeded > 1 ? ` (${overnight.roomsNeeded} rooms)` : ''}
        ${overnight.checkIn ? ` • Check-in: ${overnight.checkIn}` : ''}
        ${overnight.checkOut ? ` • Check-out: ${overnight.checkOut}` : ''}
      </div>
      ${overnight.amenities?.length ? `<div class="hotel-detail">🛏️ ${overnight.amenities.join(', ')}</div>` : ''}
      ${overnight.notes ? `<div class="hotel-detail">📝 ${overnight.notes}</div>` : ''}
    </div>
  `;
}

function buildBudgetHTML(day: TripDay, tripBudgetRemaining?: number): string {
  const budget = day.budget;

  // Only show budget tracking when the user actually set a budget.
  // tripBudgetRemaining is undefined in open mode — don't compare against $0.
  const tripBudgetHTML = tripBudgetRemaining === undefined
    ? ''  // open mode — no tracker, no "over by" nonsense
    : tripBudgetRemaining < 0
      ? `&nbsp;|&nbsp; ⚠️ Trip budget over by: ${formatCurrency(Math.abs(tripBudgetRemaining))}`
      : `&nbsp;|&nbsp; ${formatCurrency(tripBudgetRemaining)} remaining`;

  return `
    <div class="budget-row">
      💰 <strong>Day Estimate:</strong>
      ⛽ ${formatCurrency(budget.gasUsed)} fuel est.
      • 🏨 ${formatCurrency(budget.hotelCost)} hotel est.
      • 🍽️ ${formatCurrency(budget.foodEstimate)} meals est.
      • Est. total: <strong>${formatCurrency(budget.dayTotal)}</strong>
      ${tripBudgetHTML}
    </div>
  `;
}
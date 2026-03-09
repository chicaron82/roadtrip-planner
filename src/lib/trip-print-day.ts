import type { TripDay, TripSettings, RouteSegment } from '../types';
import type { DriverRotationResult } from './driver-rotation';
import type { TimedEvent } from './trip-timeline-types';
import { formatDriveTime } from './driver-rotation';
import { formatTime, formatDuration } from './trip-timeline';
import { formatDateInZone, lngToIANA } from './trip-timezone';
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
  driver: number | undefined,
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

  const driverLabel = driver ? ` [Driver ${driver}]` : '';

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
  _settings: TripSettings,
  driverRotation: DriverRotationResult | null,
  units: 'metric' | 'imperial',
  timedEvents: TimedEvent[],
  tripBudgetRemaining?: number,
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
  const timezoneHTML = day.timezoneChanges.map(change => `
    <div class="tz-alert">⏰ ${change.message}</div>
  `).join('');

  let timelineHTML = '';
  if (normalizedDayEvents.length > 0) {
    timelineHTML = normalizedDayEvents.map((event, index) => buildEventHTML(event, units, index === 0)).join('');
  } else if (dayType === 'planned' && day.segments.length > 0) {
    timelineHTML = day.segments.map((segment, index) => {
      const globalIndex = day.segmentIndices[index];
      const driver = getDriverForSegment(globalIndex, driverRotation);
      return buildSegmentHTML(segment, driver, units, index === 0);
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
      ${timezoneHTML}
      ${specialContent}
      ${timelineHTML}
      ${notesHTML}
      ${budgetHTML}
    </div>
  `;
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
  const tripBudgetHTML = tripBudgetRemaining === undefined
    ? ''
    : `
      &nbsp;|&nbsp;
      ${tripBudgetRemaining < 0
        ? `Trip budget over by: ${formatCurrency(Math.abs(tripBudgetRemaining))}`
        : `Trip budget remaining: ${formatCurrency(tripBudgetRemaining)}`}
    `;

  return `
    <div class="budget-row">
      💰 <strong>Day Estimate:</strong>
      ⛽ ${formatCurrency(budget.gasUsed)} fuel est.
      • 🏨 ${formatCurrency(budget.hotelCost)} hotel est.
      • 🍽️ ${formatCurrency(budget.foodEstimate)} meals est.
      • Est. total: <strong>${formatCurrency(budget.dayTotal)}</strong>
      ${tripBudgetHTML}
      <br />
      📊 <strong>Category budgets after this day:</strong>
      ${budget.bankRemaining < 0 ? `Budget over by ${formatCurrency(Math.abs(budget.bankRemaining))}` : `Budget remaining: ${formatCurrency(budget.bankRemaining)}`}
    </div>
  `;
}
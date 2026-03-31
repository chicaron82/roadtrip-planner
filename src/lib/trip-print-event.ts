import type { RouteSegment } from '../types';
import type { TimedEvent } from './trip-timeline-types';
import { formatDriveTime } from './driver-rotation';
import { formatTime, formatDuration } from './trip-timeline';
import {
  formatCurrency,
  formatDistance,
  formatTimeFromISO,
  getActivityEmoji,
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

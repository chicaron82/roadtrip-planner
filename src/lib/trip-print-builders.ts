/**
 * trip-print-builders.ts — HTML generation helpers for the print view.
 *
 * These functions produce the raw HTML string injected into the print popup.
 * No React, no DOM — pure string templates.
 */

import type { TripSummary, TripSettings, TripDay, RouteSegment } from '../types';
import type { DriverRotationResult } from './driver-rotation';
import type { TimedEvent } from './trip-timeline';
import { formatDriveTime } from './driver-rotation';
import { formatCurrencySimple as formatCurrency } from './calculations';
import { formatTime, formatDuration } from './trip-timeline';
import { formatTimeInZone, lngToIANA } from './trip-timezone';
import { KM_TO_MILES } from './constants';
import { PRINT_STYLES } from './trip-print-styles';

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatDistance(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${(km * KM_TO_MILES).toFixed(0)} mi`;
  return `${km.toFixed(0)} km`;
}

export function formatTimeFromISO(iso: string, tz?: string): string {
  // Round to nearest 15 minutes — no one plans to arrive at 15:13 exactly.
  const ms = new Date(iso).getTime();
  const rounded = new Date(Math.round(ms / (15 * 60 * 1000)) * (15 * 60 * 1000));
  if (tz) return formatTimeInZone(rounded, tz);
  return rounded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?am/, ' AM').replace(/\s?pm/, ' PM');
}

export function getDriverForSegment(
  segIndex: number,
  driverRotation: DriverRotationResult | null,
): number | undefined {
  if (!driverRotation) return undefined;
  return driverRotation.assignments.find(a => a.segmentIndex === segIndex)?.driver;
}

// ── Event type helpers ────────────────────────────────────────────────────────

export function getEventEmoji(type: TimedEvent['type']): string {
  switch (type) {
    case 'departure':   return '🚗';
    case 'arrival':     return '🏁';
    case 'fuel':        return '⛽';
    case 'meal':        return '🍽️';
    case 'rest':        return '☕';
    case 'overnight':   return '🏨';
    case 'destination': return '⏱️';
    case 'combo':       return '⛽🍽️';
    case 'drive':       return '→';
    default:            return '📍';
  }
}

export function getEventLabel(event: TimedEvent): string {
  switch (event.type) {
    case 'departure': return 'Depart';
    case 'arrival':   return 'Arrive';
    case 'fuel': {
      const stop = event.stops[0];
      const fillType = stop?.details?.fillType;
      const cost = stop?.details?.fuelCost;
      const costStr = cost != null ? ` · ~$${cost.toFixed(0)}` : '';
      const comboMealType = stop?.details?.comboMealType;
      if (comboMealType) {
        const mealLabel = comboMealType === 'dinner' ? 'Dinner' : 'Lunch';
        return `Fuel + ${mealLabel}${costStr}`;
      }
      return fillType === 'topup' ? `Top-Up${costStr}` : `Full Fill${costStr}`;
    }
    case 'meal': {
      const h = event.arrivalTime.getHours();
      return h < 10 || (h === 10 && event.arrivalTime.getMinutes() < 30)
        ? 'Breakfast'
        : h >= 17 ? 'Dinner' : 'Lunch';
    }
    case 'rest':        return 'Break';
    case 'overnight':   return 'Overnight';
    case 'destination': return `Time at ${event.locationHint}`;
    case 'combo':       return event.comboLabel ?? 'Fuel + Stop';
    case 'drive':       return 'Drive';
    default:            return 'Stop';
  }
}

export function getActivityEmoji(category: string): string {
  const map: Record<string, string> = {
    photo: '📸', meal: '🍽️', attraction: '🏛️', museum: '🖼️',
    shopping: '🛍️', nature: '🌲', rest: '☕', fuel: '⛽', other: '📌',
  };
  return map[category] || '📌';
}

export function getWeatherEmoji(
  weather: { temperatureMax: number; precipitationProb: number; weatherCode: number },
): string {
  if (weather.temperatureMax > 25) return '☀️';
  if (weather.precipitationProb > 40) return '🌧️';
  if (weather.weatherCode > 3) return '☁️';
  return '🌤️';
}

// ── Event HTML builder ────────────────────────────────────────────────────────

export function buildEventHTML(
  event: TimedEvent,
  units: 'metric' | 'imperial',
  isFirst: boolean,
): string {
  const emoji = getEventEmoji(event.type);
  const label = getEventLabel(event);

  // Drive segments — show as connector
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

  // Skip waypoints
  if (event.type === 'waypoint') return '';

  // Departure / Arrival — simple format
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

  // Stop events — show arrive / duration / depart
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
        ${event.timeSavedMinutes ? `<span class="time-saved">saves ${event.timeSavedMinutes} min</span>` : ''}
      </div>
    </div>
  `;
}

// ── Segment HTML builder (legacy fallback) ────────────────────────────────────

export function buildSegmentHTML(
  seg: RouteSegment,
  driver: number | undefined,
  units: 'metric' | 'imperial',
  isFirst: boolean,
): string {
  const time = seg.arrivalTime ? formatTimeFromISO(seg.arrivalTime) : '';
  const isFuelStop = seg.stopType === 'fuel';
  const isOvernight = seg.stopType === 'overnight';

  const activityHTML = seg.activity
    ? `<span class="activity">${getActivityEmoji(seg.activity.category)} ${seg.activity.name}${seg.activity.durationMinutes ? ` (${seg.activity.durationMinutes} min)` : ''}</span>`
    : '';

  const weatherHTML = seg.weather
    ? `<span class="weather">${getWeatherEmoji(seg.weather)} ${seg.weather.temperatureMax}°C, ${seg.weather.precipitationProb}% rain</span>`
    : '';

  let stopLabel = '';
  if (isFuelStop)              stopLabel = '🔁 Fuel Stop';
  else if (isOvernight)        stopLabel = '🏨 Overnight';
  else if (seg.stopType === 'meal')  stopLabel = '🍽️ Meal';
  else if (seg.stopType === 'break') stopLabel = '☕ Break';

  const driverLabel = driver ? ` [Driver ${driver}]` : '';

  return `
    <div class="segment ${isFuelStop ? 'fuel-stop' : ''} ${isFirst ? 'first-segment' : ''}">
      <div class="seg-time">${time}</div>
      <div class="seg-body">
        <strong>${seg.to.name}</strong>
        <span class="seg-stats">${formatDistance(seg.distanceKm, units)} • ${formatDriveTime(seg.durationMinutes)} • ${formatCurrency(seg.fuelCost)} fuel${driverLabel}</span>
        ${stopLabel ? `<span class="seg-stop">${stopLabel}${seg.stopDuration ? ` (${seg.stopDuration} min)` : ''}</span>` : ''}
        ${activityHTML}
        ${weatherHTML}
      </div>
    </div>
  `;
}

// ── Day HTML builder ──────────────────────────────────────────────────────────

export function buildDayHTML(
  day: TripDay,
  _settings: TripSettings,
  driverRotation: DriverRotationResult | null,
  units: 'metric' | 'imperial',
  timedEvents: TimedEvent[],
): string {
  const dayType = day.dayType || 'planned';

  // Hotel info
  let hotelHTML = '';
  if (day.overnight) {
    const o = day.overnight;
    hotelHTML = `
      <div class="hotel-card">
        <div class="hotel-name">🔑 ${o.hotelName || 'Overnight Stay'}</div>
        ${o.address ? `<div class="hotel-detail">📍 ${o.address}</div>` : ''}
        <div class="hotel-detail">
          💵 ${formatCurrency(o.cost)}
          ${o.roomsNeeded > 1 ? ` (${o.roomsNeeded} rooms)` : ''}
          ${o.checkIn ? ` • Check-in: ${o.checkIn}` : ''}
          ${o.checkOut ? ` • Check-out: ${o.checkOut}` : ''}
        </div>
        ${o.amenities?.length ? `<div class="hotel-detail">🛏️ ${o.amenities.join(', ')}</div>` : ''}
        ${o.notes ? `<div class="hotel-detail">📝 ${o.notes}</div>` : ''}
      </div>
    `;
  }

  // Timezone changes
  const tzHTML = day.timezoneChanges.map(tz => `
    <div class="tz-alert">⏰ ${tz.message}</div>
  `).join('');

  // Build timeline
  let timelineHTML = '';
  if (timedEvents.length > 0 && dayType === 'planned') {
    const dayDate = new Date(day.totals.departureTime).toDateString();
    const dayEvents = timedEvents.filter(e => e.arrivalTime.toDateString() === dayDate);
    timelineHTML = dayEvents.map((event, i) => buildEventHTML(event, units, i === 0)).join('');
  } else if (dayType === 'planned' && day.segments.length > 0) {
    timelineHTML = day.segments.map((seg, i) => {
      const globalIndex = day.segmentIndices[i];
      const driver = getDriverForSegment(globalIndex, driverRotation);
      return buildSegmentHTML(seg, driver, units, i === 0);
    }).join('');
  }

  // Special day content
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

  const b = day.budget;
  const budgetHTML = `
    <div class="budget-row">
      💰 <strong>Daily Budget:</strong>
      ⛽ ${formatCurrency(b.gasUsed)} gas
      • 🏨 ${formatCurrency(b.hotelCost)} hotel
      • 🍽️ ${formatCurrency(b.foodEstimate)} food
      • Total: <strong>${formatCurrency(b.dayTotal)}</strong>
      &nbsp;|&nbsp;
      ${b.gasRemaining < 0 ? `Gas over by: ${formatCurrency(Math.abs(b.gasRemaining))}` : `Gas remaining: ${formatCurrency(b.gasRemaining)}`}
      • ${b.hotelRemaining < 0 ? `Hotel over by: ${formatCurrency(Math.abs(b.hotelRemaining))}` : `Hotel remaining: ${formatCurrency(b.hotelRemaining)}`}
    </div>
  `;

  const routeLabel = day.route || (dayType === 'free' ? 'Free Day' : dayType === 'flexible' ? 'Flexible Day' : '—');
  // Derive display timezone from the day's departure city longitude — same
  // source the timeline engine uses, so header times match timeline event times.
  const depTz = day.segments[0]?.from.lng != null ? lngToIANA(day.segments[0].from.lng) : undefined;
  const sameTime = day.totals.departureTime === day.totals.arrivalTime;
  const statsLine = dayType !== 'free'
    ? `${formatDistance(day.totals.distanceKm, units)} •
       ${formatDriveTime(day.totals.driveTimeMinutes)} driving •
       Departure: ${formatTimeFromISO(day.totals.departureTime, depTz)}${sameTime ? '' : ` • Arrival: ${formatTimeFromISO(day.totals.arrivalTime, depTz)}`}`
    : 'Rest day — no driving';

  return `
    <div class="day-section">
      <div class="day-header">
        <h2>🗓️ Day ${day.dayNumber} — ${day.dateFormatted}</h2>
        ${day.title ? `<div class="day-title">🚗 ${day.title}</div>` : ''}
        <div class="day-route">Route: ${routeLabel}</div>
        <div class="day-stats">${statsLine}</div>
      </div>
      ${hotelHTML}
      ${tzHTML}
      ${specialContent}
      ${timelineHTML}
      ${notesHTML}
      ${budgetHTML}
    </div>
  `;
}

// ── Top-level HTML envelope ───────────────────────────────────────────────────

export function buildPrintHTML(
  tripTitle: string,
  summary: TripSummary,
  settings: TripSettings,
  days: TripDay[],
  driverRotation: DriverRotationResult | null,
  timedEvents: TimedEvent[],
): string {
  const units = settings.units;

  const overviewHTML = `
    <div class="overview">
      <h1>🗺️ ${tripTitle}</h1>
      <div class="stats-row">
        <span>📏 ${formatDistance(summary.totalDistanceKm, units)}</span>
        <span>⏱️ ${formatDriveTime(summary.totalDurationMinutes)} driving</span>
        <span>⛽ ${formatCurrency(summary.totalFuelCost)} fuel</span>
        <span>👥 ${settings.numTravelers} traveler${settings.numTravelers > 1 ? 's' : ''}</span>
        ${settings.numDrivers > 1 ? `<span>🔁 ${settings.numDrivers} drivers</span>` : ''}
        <span>📅 ${days.length} day${days.length !== 1 ? 's' : ''}</span>
      </div>
      ${summary.costBreakdown ? `
        <div class="budget-overview">
          <strong>Trip Total: ${formatCurrency(summary.costBreakdown.total)}</strong>
          (${formatCurrency(summary.costBreakdown.total / settings.numTravelers)}/person)
          &nbsp;|&nbsp;
          ⛽ ${formatCurrency(summary.costBreakdown.fuel)} fuel &nbsp;
          🏨 ${formatCurrency(summary.costBreakdown.accommodation)} hotel &nbsp;
          🍽️ ${formatCurrency(summary.costBreakdown.meals)} food &nbsp;
          📦 ${formatCurrency(summary.costBreakdown.misc)} misc
        </div>
      ` : ''}
    </div>
  `;

  const daysHTML = days.map(day => buildDayHTML(day, settings, driverRotation, units, timedEvents)).join('\n');

  let driverHTML = '';
  if (driverRotation && driverRotation.stats.length > 1) {
    driverHTML = `
      <div class="section driver-stats">
        <h2>🔁 Driver Rotation Summary</h2>
        <table>
          <thead>
            <tr><th>Driver</th><th>Drive Time</th><th>Distance</th><th>Segments</th></tr>
          </thead>
          <tbody>
            ${driverRotation.stats.map(s => `
              <tr>
                <td>Driver ${s.driver}</td>
                <td>${formatDriveTime(s.totalMinutes)}</td>
                <td>${formatDistance(s.totalKm, units)}</td>
                <td>${s.segmentCount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${tripTitle} — Trip Itinerary</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${overviewHTML}
  ${daysHTML}
  ${driverHTML}
  <footer>
    <p>Generated by My Experience Engine • ${new Date().toLocaleDateString()}</p>
  </footer>
</body>
</html>`;
}

/**
 * Trip Print View
 *
 * Renders a clean, print-optimized version of the trip itinerary.
 * Uses window.print() with a dedicated print container — no external dependencies.
 *
 * Modeled after the manual roadtrip2025.txt gold standard format:
 * - Per-day breakdown with hotel, route, budget
 * - Fuel stops with driver rotation
 * - Timezone changes
 * - Running budget totals
 */

import type { TripSummary, TripSettings, TripDay, RouteSegment } from '../../types';
import type { DriverRotationResult } from '../../lib/driver-rotation';
import { assignDrivers, formatDriveTime } from '../../lib/driver-rotation';

// ==================== TYPES ====================

interface TripPrintViewProps {
  summary: TripSummary;
  settings: TripSettings;
}

// ==================== HELPERS ====================

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDistance(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') return `${(km * 0.621371).toFixed(0)} mi`;
  return `${km.toFixed(0)} km`;
}

function formatTimeFromISO(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getDriverForSegment(
  segIndex: number,
  driverRotation: DriverRotationResult | null,
): number | undefined {
  if (!driverRotation) return undefined;
  return driverRotation.assignments.find(a => a.segmentIndex === segIndex)?.driver;
}

// ==================== PRINT FUNCTION ====================

export function printTrip(props: TripPrintViewProps): void {
  const { summary, settings } = props;
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

  const origin = summary.segments[0]?.from.name || 'Origin';
  const destination = summary.segments[summary.segments.length - 1]?.to.name || 'Destination';
  const tripTitle = `${origin} → ${destination}`;

  const html = buildPrintHTML(tripTitle, summary, settings, days, driverRotation);

  // Open print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Please allow popups to print your trip.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to render, then print
  printWindow.onload = () => {
    printWindow.print();
  };
}

// ==================== HTML BUILDER ====================

function buildPrintHTML(
  tripTitle: string,
  summary: TripSummary,
  settings: TripSettings,
  days: TripDay[],
  driverRotation: DriverRotationResult | null,
): string {
  const units = settings.units;

  // Trip overview stats
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

  // Per-day sections
  const daysHTML = days.map(day => buildDayHTML(day, settings, driverRotation, units)).join('\n');

  // Driver stats (if multiple drivers)
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
    <p>Generated by The Experience Engine • ${new Date().toLocaleDateString()}</p>
  </footer>
</body>
</html>`;
}

// ==================== DAY BUILDER ====================

function buildDayHTML(
  day: TripDay,
  _settings: TripSettings,
  driverRotation: DriverRotationResult | null,
  units: 'metric' | 'imperial',
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

  // Segments timeline
  let timelineHTML = '';
  if (dayType === 'planned' && day.segments.length > 0) {
    timelineHTML = day.segments.map((seg, i) => {
      const globalIndex = day.segmentIndices[i];
      const driver = getDriverForSegment(globalIndex, driverRotation);
      return buildSegmentHTML(seg, driver, units, i === 0);
    }).join('');
  }

  // Free/flexible day content
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

  // Notes
  const notesHTML = day.notes ? `<div class="day-notes">📝 ${day.notes}</div>` : '';

  // Budget
  const b = day.budget;
  const budgetHTML = `
    <div class="budget-row">
      💰 <strong>Daily Budget:</strong>
      ⛽ ${formatCurrency(b.gasUsed)} gas
      • 🏨 ${formatCurrency(b.hotelCost)} hotel
      • 🍽️ ${formatCurrency(b.foodEstimate)} food
      • Total: <strong>${formatCurrency(b.dayTotal)}</strong>
      &nbsp;|&nbsp;
      Gas remaining: ${formatCurrency(b.gasRemaining)}
      • Hotel remaining: ${formatCurrency(b.hotelRemaining)}
    </div>
  `;

  return `
    <div class="day-section">
      <div class="day-header">
        <h2>🗓️ Day ${day.dayNumber} — ${day.dateFormatted}</h2>
        ${day.title ? `<div class="day-title">🚗 ${day.title}</div>` : ''}
        <div class="day-route">Route: ${day.route}</div>
        <div class="day-stats">
          ${formatDistance(day.totals.distanceKm, units)} •
          ${formatDriveTime(day.totals.driveTimeMinutes)} driving •
          Departure: ${formatTimeFromISO(day.totals.departureTime)} •
          Arrival: ${formatTimeFromISO(day.totals.arrivalTime)}
        </div>
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

// ==================== SEGMENT BUILDER ====================

function buildSegmentHTML(
  seg: RouteSegment,
  driver: number | undefined,
  units: 'metric' | 'imperial',
  isFirst: boolean,
): string {
  const time = seg.arrivalTime ? formatTimeFromISO(seg.arrivalTime) : '';
  const isFuelStop = seg.stopType === 'fuel';
  const isOvernight = seg.stopType === 'overnight';

  // Activity
  const activityHTML = seg.activity
    ? `<span class="activity">${getActivityEmoji(seg.activity.category)} ${seg.activity.name}${seg.activity.durationMinutes ? ` (${seg.activity.durationMinutes} min)` : ''}</span>`
    : '';

  // Weather
  const weatherHTML = seg.weather
    ? `<span class="weather">${getWeatherEmoji(seg.weather)} ${seg.weather.temperatureMax}°C, ${seg.weather.precipitationProb}% rain</span>`
    : '';

  // Stop type indicator
  let stopLabel = '';
  if (isFuelStop) stopLabel = '🔁 Fuel Stop';
  else if (isOvernight) stopLabel = '🏨 Overnight';
  else if (seg.stopType === 'meal') stopLabel = '🍽️ Meal';
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

function getActivityEmoji(category: string): string {
  const map: Record<string, string> = {
    photo: '📸', meal: '🍽️', attraction: '🏛️', museum: '🖼️',
    shopping: '🛍️', nature: '🌲', rest: '☕', fuel: '⛽', other: '📌',
  };
  return map[category] || '📌';
}

function getWeatherEmoji(weather: { temperatureMax: number; precipitationProb: number; weatherCode: number }): string {
  if (weather.temperatureMax > 25) return '☀️';
  if (weather.precipitationProb > 40) return '🌧️';
  if (weather.weatherCode > 3) return '☁️';
  return '🌤️';
}

// ==================== PRINT STYLES ====================

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    padding: 16px;
  }

  h1 {
    font-size: 18pt;
    margin-bottom: 8px;
  }

  h2 {
    font-size: 14pt;
    margin-bottom: 4px;
  }

  .overview {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid #333;
  }

  .stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 10pt;
    color: #555;
    margin-top: 8px;
  }

  .budget-overview {
    margin-top: 8px;
    font-size: 10pt;
    color: #333;
    background: #f5f5f5;
    padding: 6px 10px;
    border-radius: 4px;
  }

  .day-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ddd;
    page-break-inside: avoid;
  }

  .day-header {
    margin-bottom: 8px;
  }

  .day-title {
    font-weight: 600;
    font-size: 11pt;
    margin-top: 2px;
  }

  .day-route {
    color: #555;
    font-size: 10pt;
  }

  .day-stats {
    color: #777;
    font-size: 9pt;
    margin-top: 2px;
  }

  .hotel-card {
    background: #f0f0ff;
    border: 1px solid #c7c7f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin: 8px 0;
    font-size: 10pt;
  }

  .hotel-name {
    font-weight: 700;
    font-size: 11pt;
  }

  .hotel-detail {
    color: #444;
    margin-top: 2px;
  }

  .tz-alert {
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 9.5pt;
    margin: 4px 0;
    font-weight: 600;
  }

  .segment {
    display: flex;
    gap: 12px;
    padding: 4px 0;
    border-top: 1px dotted #e0e0e0;
    font-size: 10pt;
  }

  .segment.first-segment {
    border-top: none;
  }

  .segment.fuel-stop {
    background: #fff8f0;
  }

  .seg-time {
    width: 70px;
    flex-shrink: 0;
    font-weight: 600;
    color: #333;
    font-size: 9.5pt;
    padding-top: 1px;
  }

  .seg-body {
    flex: 1;
  }

  .seg-body strong {
    display: block;
  }

  .seg-stats {
    display: block;
    color: #777;
    font-size: 9pt;
  }

  .seg-stop {
    display: inline-block;
    background: #e8f4e8;
    color: #2e7d32;
    font-size: 8.5pt;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    margin-top: 2px;
  }

  .activity {
    display: block;
    color: #1565c0;
    font-size: 9.5pt;
    margin-top: 2px;
  }

  .weather {
    display: block;
    color: #0288d1;
    font-size: 9pt;
  }

  .budget-row {
    font-size: 9.5pt;
    color: #333;
    margin-top: 8px;
    padding: 6px 8px;
    background: #f9f9f9;
    border-radius: 4px;
    border: 1px solid #eee;
  }

  .day-notes {
    font-size: 9.5pt;
    color: #555;
    font-style: italic;
    margin-top: 4px;
  }

  .free-day, .flexible-day {
    font-size: 10pt;
    color: #666;
    padding: 8px;
    background: #f0faf0;
    border-radius: 4px;
    margin: 8px 0;
  }

  .driver-stats {
    margin-top: 16px;
    page-break-inside: avoid;
  }

  .driver-stats table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-top: 8px;
  }

  .driver-stats th, .driver-stats td {
    border: 1px solid #ddd;
    padding: 6px 10px;
    text-align: left;
  }

  .driver-stats th {
    background: #f5f5f5;
    font-weight: 600;
  }

  footer {
    margin-top: 24px;
    text-align: center;
    font-size: 8.5pt;
    color: #999;
    border-top: 1px solid #eee;
    padding-top: 8px;
  }

  @media print {
    body { padding: 0; }
    .day-section { page-break-inside: avoid; }
    .overview { border-bottom-color: #000; }
  }
`;

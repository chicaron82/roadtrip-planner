/**
 * trip-print-cover.ts — Page 1 "Trip Summary" cover page for the print view.
 *
 * Builds the human-readable cover page that precedes the day-by-day itinerary.
 * Designed for the "show Grandma" use-case: reassuring, scannable, no jargon.
 *
 * Pure HTML string builder — no React, no DOM.
 */

import type { TripSummary, TripSettings, Vehicle } from '../types';
import type { DriverRotationResult } from './driver-rotation';
import type { FeasibilityResult } from './feasibility/types';
import type { WarningCategory } from './feasibility/types';
import { formatCurrency, formatDistance } from './trip-print-formatters';
import { formatDriveTime, getDriverName } from './driver-rotation';

// ── Emoji map for warning categories ─────────────────────────────────────────

const WARNING_EMOJI: Record<WarningCategory, string> = {
  'budget':      '💰',
  'drive-time':  '⏱️',
  'timing':      '🌅',
  'fuel':        '⛽',
  'driver':      '🔁',
  'date-window': '📅',
  'passenger':   '👥',
};

// ── Section builders ──────────────────────────────────────────────────────────

function buildHeroSection(
  tripTitle: string,
  summary: TripSummary,
  settings: TripSettings,
): string {
  const days = summary.days ?? [];
  const startDate = days[0]?.dateFormatted ?? '';
  const endDate   = days[days.length - 1]?.dateFormatted ?? '';
  const dateRange = startDate && endDate && startDate !== endDate
    ? `${startDate} – ${endDate}`
    : startDate || '';

  const units = settings.units;
  const metaParts: string[] = [
    `${days.length} day${days.length !== 1 ? 's' : ''}`,
    formatDistance(summary.totalDistanceKm, units),
    `${formatDriveTime(summary.totalDurationMinutes)} driving`,
    `${settings.numTravelers} traveler${settings.numTravelers !== 1 ? 's' : ''}`,
  ];
  if (settings.numDrivers > 1) {
    metaParts.push(`${settings.numDrivers} drivers rotating`);
  }

  return `
    <div class="cover-hero">
      <h1>🗺️ ${tripTitle}</h1>
      ${dateRange ? `<div class="cover-dates">${dateRange}</div>` : ''}
      <div class="cover-meta">${metaParts.join('  •  ')}</div>
    </div>
  `;
}

function buildBudgetStatusCard(
  summary: TripSummary,
  settings: TripSettings,
  feasibility: FeasibilityResult,
): string {
  const hasBudget = settings.budgetMode === 'plan-to-budget' && settings.budget.total > 0;
  const costBreakdown = summary.costBreakdown;
  const perPerson = costBreakdown && settings.numTravelers > 0
    ? costBreakdown.total / settings.numTravelers
    : null;

  let cardClass: string;
  let headline: string;
  let detail: string;

  if (!hasBudget) {
    // Open mode: just show the estimated cost
    if (!costBreakdown) return '';
    cardClass = 'cover-status-neutral';
    headline = `📊 Estimated trip cost: ${formatCurrency(costBreakdown.total)}`;
    detail = perPerson
      ? `≈ ${formatCurrency(perPerson)} per person`
      : '';
  } else {
    const bankRemaining = summary.budgetRemaining ?? 0;
    const estTotal = costBreakdown?.total ?? (settings.budget.total - bankRemaining);
    const perPersonStr = perPerson ? `  •  ≈ ${formatCurrency(perPerson)} per person` : '';

    const budgetWarning = feasibility.warnings.find(w => w.category === 'budget' && w.severity !== 'info');

    if (budgetWarning && bankRemaining < 0) {
      cardClass = 'cover-status-over';
      headline = `🚨 Trip may run over estimate.`;
      detail = `Est. ${formatCurrency(estTotal)} vs ${formatCurrency(settings.budget.total)} budget — ${formatCurrency(Math.abs(bankRemaining))} over.${perPersonStr}`;
    } else if (budgetWarning) {
      cardClass = 'cover-status-tight';
      headline = `⚡ Running close to budget.`;
      detail = `Est. ${formatCurrency(estTotal)} of ${formatCurrency(settings.budget.total)} — ${formatCurrency(Math.abs(bankRemaining))} to spare.${perPersonStr}`;
    } else {
      cardClass = 'cover-status-ok';
      headline = `✅ Budget is sound.`;
      detail = `Est. ${formatCurrency(estTotal)} of ${formatCurrency(settings.budget.total)} — ${formatCurrency(bankRemaining)} to spare.${perPersonStr}`;
    }
  }

  return `
    <div class="cover-section">
      <div class="cover-section-label">💰 Budget Status</div>
      <div class="cover-status-card ${cardClass}">
        <div class="cover-status-headline">${headline}</div>
        ${detail ? `<div class="cover-status-detail">${detail}</div>` : ''}
      </div>
    </div>
  `;
}

function buildWarningsSection(feasibility: FeasibilityResult): string {
  const actionable = feasibility.warnings.filter(w => w.severity !== 'info');
  if (actionable.length === 0) return '';

  const items = actionable.map(w => {
    const emoji = WARNING_EMOJI[w.category] ?? '⚠️';
    const dayTag = w.dayNumber !== undefined ? ` — Day ${w.dayNumber}` : '';
    return `
      <div class="cover-warning-item">
        <div class="cover-warning-msg">${emoji} ${w.message}${dayTag}</div>
        ${w.suggestion ? `<div class="cover-warning-tip">${w.suggestion}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="cover-section">
      <div class="cover-section-label">⚠️ Heads Up</div>
      ${items}
    </div>
  `;
}

function buildPacingSection(
  summary: TripSummary,
  settings: TripSettings,
  vehicle?: Vehicle,
): string {
  const isBeastMode = settings.maxDriveHours >= 12;
  const driveLabel = isBeastMode
    ? `<span class="beast-badge">⚡ BEAST MODE</span> — ${settings.maxDriveHours}h max/day`
    : `Max ${settings.maxDriveHours}h driving/day`;

  const days = summary.days ?? [];
  const departure = days[0]?.totals.departureTime;
  let departureStr = '';
  if (departure) {
    const d = new Date(departure);
    departureStr = `  •  Smart departure from ${d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }

  let vehicleStr = '';
  if (vehicle) {
    const tankStr = settings.units === 'metric'
      ? `${vehicle.tankSize}L tank`
      : `${vehicle.tankSize} gal tank`;
    vehicleStr = `<div>${vehicle.year} ${vehicle.make} ${vehicle.model}  •  ${tankStr}</div>`;
  }

  return `
    <div class="cover-section">
      <div class="cover-section-label">🏎️ Pacing</div>
      <div class="cover-pacing">
        ${vehicleStr}
        <div>${driveLabel}${departureStr}</div>
      </div>
    </div>
  `;
}

function buildRosterSection(
  driverRotation: DriverRotationResult | null,
  settings: TripSettings,
): string {
  if (settings.numDrivers <= 1 || !driverRotation || driverRotation.stats.length <= 1) return '';

  const units = settings.units;
  const rows = driverRotation.stats.map(s => `
    <tr>
      <td>${getDriverName(s.driver, settings.driverNames)}</td>
      <td>${formatDriveTime(s.totalMinutes)}</td>
      <td>${formatDistance(s.totalKm, units)}</td>
      <td>${s.segmentCount}</td>
    </tr>
  `).join('');

  return `
    <div class="cover-section">
      <div class="cover-section-label">🔁 Driver Roster</div>
      <table class="cover-roster-table">
        <thead>
          <tr><th>Name</th><th>Drive Time</th><th>Distance</th><th>Segments</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildCoverPageHTML(
  tripTitle: string,
  summary: TripSummary,
  settings: TripSettings,
  feasibility: FeasibilityResult,
  driverRotation: DriverRotationResult | null,
  vehicle?: Vehicle,
): string {
  const heroHTML    = buildHeroSection(tripTitle, summary, settings);
  const budgetHTML  = buildBudgetStatusCard(summary, settings, feasibility);
  const warningHTML = buildWarningsSection(feasibility);
  const pacingHTML  = buildPacingSection(summary, settings, vehicle);
  const rosterHTML  = buildRosterSection(driverRotation, settings);

  const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  // "Your MEE time" tagline — personal date range for the brand block
  const allDays = summary.days ?? [];
  const firstDay = allDays[0];
  const lastDay  = allDays[allDays.length - 1];
  let meeTimeStr = '';
  if (firstDay?.date && lastDay?.date) {
    const start     = new Date(firstDay.date + 'T00:00:00');
    const end       = new Date(lastDay.date  + 'T00:00:00');
    const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
    const endMonth   = end.toLocaleDateString('en-US',   { month: 'long' });
    const endYear    = end.getFullYear();
    meeTimeStr = startMonth === endMonth
      ? ` — ${startMonth} ${start.getDate()}–${end.getDate()}, ${endYear}`
      : ` — ${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${endYear}`;
  }

  return `
    <div class="cover-page">
      <div class="cover-brand">
        <div class="cover-brand-name">My Experience Engine (M.E.E)</div>
        <div class="cover-brand-tagline">Your MEE time${meeTimeStr}</div>
      </div>
      <hr class="cover-divider" />
      ${heroHTML}
      ${budgetHTML}
      ${warningHTML}
      ${pacingHTML}
      ${rosterHTML}
      <div class="cover-footer">My Experience Engine  •  ${dateStr}</div>
    </div>
  `;
}

import type { TripJournal, TripSettings } from '../types';
import { showToast } from './toast';
import { escapeHtml } from './utils';
import { getExportBudgetBreakdown, getTripDisplayEndpoints } from './trip-summary-view';
import { resolveJournalEntryLocation } from './journal-trip-view';
import type { JournalExportSummary, SegmentLookupSummary } from './trip-summary-slices';
import type { PrintInput } from './canonical-trip';
import { buildAutoTitle } from './mee-tokens';
import { buildTemplateLineage } from './url';

// ── Stylesheet ────────────────────────────────────────────────────────────────

const JOURNAL_HTML_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  @page { size: A4 portrait; margin: 15mm 18mm; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt; line-height: 1.6; color: #1a1a1a;
    background: #faf9f7; padding: 24px; max-width: 900px; margin: 0 auto;
  }

  /* Cover */
  .cover { padding: 28px 0 22px; border-bottom: 2px solid #e5e0d8; margin-bottom: 28px; }
  .cover-brand { font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: #aaa; font-weight: 700; margin-bottom: 14px; }
  .cover-title { font-size: 26pt; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #111; margin-bottom: 6px; }
  .cover-route { font-size: 11.5pt; color: #666; margin-bottom: 14px; }
  .cover-dates { font-size: 9.5pt; color: #888; margin-bottom: 18px; }
  .cover-stats { display: flex; gap: 28px; flex-wrap: wrap; }
  .stat-value { font-size: 15pt; font-weight: 700; color: #10b981; display: block; }
  .stat-label { font-size: 8pt; color: #999; text-transform: uppercase; letter-spacing: 0.08em; }

  /* Section headings */
  .section-heading {
    font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em;
    color: #aaa; margin: 26px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e0d8;
  }

  /* Stop cards */
  .stop-card {
    margin-bottom: 16px; padding: 14px 16px; border-radius: 8px;
    background: #fff; border: 1px solid #ede8e0; border-left: 4px solid #10b981;
    page-break-inside: avoid;
  }
  .stop-card.skipped { border-left-color: #d1d5db; opacity: 0.75; }
  .stop-card.highlight { border-left-color: #f59e0b; background: #fffdf5; }
  .stop-name { font-size: 13pt; font-weight: 700; margin-bottom: 6px; }
  .stop-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .stop-status { font-size: 7.5pt; padding: 2px 8px; border-radius: 9999px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .status-visited { background: #d1fae5; color: #065f46; }
  .status-skipped { background: #f3f4f6; color: #6b7280; }
  .stop-rating { color: #f59e0b; font-size: 12pt; }
  .highlight-badge { font-size: 8pt; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 9999px; font-weight: 600; }
  .stop-notes { font-size: 10.5pt; color: #374151; line-height: 1.65; margin-top: 8px; }

  /* Photo grid */
  .photo-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .photo-figure { margin: 0; }
  .photo-figure img { width: 195px; height: 138px; object-fit: cover; border-radius: 6px; border: 1px solid #ede8e0; display: block; }
  .photo-caption { font-size: 7.5pt; color: #6b7280; margin-top: 4px; max-width: 195px; font-style: italic; }

  /* Quick captures */
  .captures-grid { display: flex; flex-wrap: wrap; gap: 14px; }
  .capture-card { border: 1px solid #ede8e0; border-radius: 8px; overflow: hidden; background: #fff; page-break-inside: avoid; flex: 0 0 auto; max-width: 215px; }
  .capture-card img { width: 215px; height: 140px; object-fit: cover; display: block; }
  .capture-body { padding: 8px 10px; }
  .capture-location { font-size: 9pt; font-weight: 700; color: #7c3aed; margin-bottom: 3px; }
  .capture-category { font-size: 7.5pt; background: #f3e8ff; color: #6d28d9; padding: 1px 7px; border-radius: 9999px; display: inline-block; margin-bottom: 5px; }
  .capture-caption { font-size: 8.5pt; color: #4b5563; font-style: italic; }
  .capture-gps { font-size: 7.5pt; color: #9ca3af; margin-top: 5px; }
  .capture-maps { color: #2563eb; text-decoration: none; }

  /* Stats */
  .stats-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-top: 6px; }
  .stats-table td { padding: 7px 10px; border-bottom: 1px solid #ede8e0; }
  .stats-table td:first-child { color: #777; font-size: 9.5pt; }
  .stats-table td:last-child { font-weight: 700; text-align: right; }

  footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e5e0d8; text-align: center; font-size: 8.5pt; color: #ccc; }

  @media print {
    body { padding: 0; background: #fff; }
    .stop-card, .capture-card { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
`;

// ── HTML export ───────────────────────────────────────────────────────────────

/**
 * Export the trip journal as a downloadable, print-ready HTML file.
 */
export function exportJournalAsHTML(journal: TripJournal, summary: SegmentLookupSummary): void {
  const { metadata, stats, tripSummary, entries, quickCaptures } = journal;
  const endpoints = getTripDisplayEndpoints(summary);
  const routeLabel = endpoints.origin && endpoints.destination
    ? `${escapeHtml(endpoints.origin.name)} → ${escapeHtml(endpoints.destination.name)}`
    : '';

  const tripDate = metadata.dates.actualStart ?? metadata.dates.plannedStart;
  const tripEnd = metadata.dates.actualEnd ?? metadata.dates.plannedEnd;
  const dateRange = tripDate
    ? `${new Date(tripDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${tripEnd && tripEnd !== tripDate ? ` – ${new Date(tripEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}`
    : '';

  const stopsHTML = entries.map(e => {
    const stop = resolveJournalEntryLocation(summary, e);
    const isHighlight = e.isHighlight;
    const cardClass = `stop-card${isHighlight ? ' highlight' : ''}${e.status === 'skipped' ? ' skipped' : ''}`;
    const statusClass = e.status === 'visited' ? 'status-visited' : 'status-skipped';
    const ratingStars = e.rating ? '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating) : '';
    const photosHTML = e.photos.length > 0
      ? `<div class="photo-grid">${e.photos.map(p => `
          <figure class="photo-figure">
            <img src="${p.dataUrl}" alt="${escapeHtml(p.caption || '')}" />
            ${p.caption ? `<figcaption class="photo-caption">${escapeHtml(p.caption)}</figcaption>` : ''}
          </figure>`).join('')}</div>`
      : '';
    return `
    <div class="${cardClass}">
      <div class="stop-name">${escapeHtml(stop?.name || 'Unknown Stop')}</div>
      <div class="stop-meta">
        <span class="stop-status ${statusClass}">${e.status}</span>
        ${ratingStars ? `<span class="stop-rating">${ratingStars}</span>` : ''}
        ${isHighlight && e.highlightReason ? `<span class="highlight-badge">✨ ${escapeHtml(e.highlightReason)}</span>` : ''}
        ${isHighlight && !e.highlightReason ? `<span class="highlight-badge">✨ Highlight</span>` : ''}
      </div>
      ${e.notes ? `<p class="stop-notes">${escapeHtml(e.notes)}</p>` : ''}
      ${photosHTML}
    </div>`;
  }).join('');

  const capturesHTML = quickCaptures.length > 0 ? `
    <h2 class="section-heading">Memories Along the Way</h2>
    <div class="captures-grid">
      ${quickCaptures.map(qc => {
        const mapsLink = qc.gpsCoords
          ? `https://www.google.com/maps?q=${qc.gpsCoords.lat},${qc.gpsCoords.lng}`
          : qc.photo?.location && (qc.photo.location.lat !== 0 || qc.photo.location.lng !== 0)
            ? `https://www.google.com/maps?q=${qc.photo.location.lat},${qc.photo.location.lng}`
            : null;
        return `
        <div class="capture-card">
          ${qc.photo ? `<img src="${qc.photo.dataUrl}" alt="${escapeHtml(qc.photo.caption || '')}" />` : ''}
          <div class="capture-body">
            <div class="capture-location">${escapeHtml(qc.autoTaggedLocation || 'Quick Memory')}</div>
            ${qc.category ? `<span class="capture-category">${escapeHtml(qc.category)}</span>` : ''}
            ${qc.photo?.caption ? `<p class="capture-caption">${escapeHtml(qc.photo.caption)}</p>` : ''}
            ${qc.gpsCoords ? `<p class="capture-gps">${qc.gpsCoords.lat.toFixed(5)}, ${qc.gpsCoords.lng.toFixed(5)}${mapsLink ? ` · <a class="capture-maps" href="${mapsLink}">View on Maps</a>` : ''}</p>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(metadata.title)}</title>
  <style>${JOURNAL_HTML_STYLES}</style>
</head>
<body>
  <div class="cover">
    <div class="cover-brand">My Experience Engine · Trip Journal</div>
    <h1 class="cover-title">${escapeHtml(metadata.title)}</h1>
    ${routeLabel ? `<p class="cover-route">${routeLabel}</p>` : ''}
    ${dateRange ? `<p class="cover-dates">${dateRange}</p>` : ''}
    <div class="cover-stats">
      <div><span class="stat-value">${tripSummary.totalDistanceKm.toFixed(0)} km</span><span class="stat-label">Distance</span></div>
      <div><span class="stat-value">${stats.stopsVisited}</span><span class="stat-label">Stops visited</span></div>
      <div><span class="stat-value">${stats.photosCount}</span><span class="stat-label">Photos</span></div>
      <div><span class="stat-value">${stats.highlightsCount}</span><span class="stat-label">Highlights</span></div>
      ${metadata.travelers?.length ? `<div><span class="stat-value">${escapeHtml(metadata.travelers.join(', '))}</span><span class="stat-label">Travelers</span></div>` : ''}
    </div>
  </div>

  <h2 class="section-heading">Journey</h2>
  ${stopsHTML}

  ${capturesHTML}

  <h2 class="section-heading">Trip Stats</h2>
  <table class="stats-table">
    <tr><td>Total stops</td><td>${stats.stopsVisited + stats.stopsSkipped}</td></tr>
    <tr><td>Visited</td><td>${stats.stopsVisited}</td></tr>
    <tr><td>Skipped</td><td>${stats.stopsSkipped}</td></tr>
    <tr><td>Photos captured</td><td>${stats.photosCount}</td></tr>
    <tr><td>Highlights</td><td>${stats.highlightsCount}</td></tr>
    <tr><td>Distance</td><td>${tripSummary.totalDistanceKm.toFixed(1)} km</td></tr>
    <tr><td>Drive time</td><td>${(tripSummary.totalDurationMinutes / 60).toFixed(1)} h</td></tr>
  </table>

  <footer>Generated by My Experience Engine · ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = metadata.title
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 100) || 'untitled';
  link.download = `roadtrip-journal-${safeTitle}.html`;
  link.click();
  URL.revokeObjectURL(url);

  showToast({
    message: 'Journal exported! Open the HTML file in your browser and print to PDF (Ctrl+P)',
    type: 'success',
    duration: 4000,
  });
}

// ── Share options ─────────────────────────────────────────────────────────────

export interface ShareOptions {
  includeRoute: boolean;      // required — share button disabled when false
  includeDates: boolean;
  includeTravelers: boolean;
  includeBudget: boolean;
  includeOrigin: boolean;
  includeNotes: boolean;
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  includeRoute: true,
  includeDates: true,
  includeTravelers: true,
  includeBudget: false,
  includeOrigin: true,
  includeNotes: true,
};

// ── Template export ───────────────────────────────────────────────────────────

/**
 * Export the trip as a loadable JSON template that others can import.
 */
export function exportJournalAsTemplate(journal: TripJournal, summary: JournalExportSummary, settings: TripSettings): void {
  const endpoints = getTripDisplayEndpoints(summary);
  const exportBudget = getExportBudgetBreakdown(summary);

  const forkLineage = journal.origin?.type === 'template' && journal.origin.id
    ? buildTemplateLineage({ templateId: journal.origin.id, lineage: undefined, title: '', author: '', description: '', recommendations: undefined })
    : undefined;

  const template = {
    type: 'roadtrip-template',
    version: '1.0',
    id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    author: journal.metadata.travelers?.[0] || 'Anonymous',
    ...(forkLineage ? { lineage: forkLineage } : {}),

    trip: {
      title: journal.metadata.title,
      description: journal.metadata.description || 'Follow this roadtrip route!',
      tags: journal.metadata.tags,
      durationDays: journal.tripSummary.days?.length || 1,
      totalDistanceKm: journal.tripSummary.totalDistanceKm,
      totalDurationHours: (journal.tripSummary.totalDurationMinutes / 60).toFixed(1),
    },

    budget: {
      profile: settings.budget.profile,
      totalSpent: journal.stats.totalActualSpent,
      perPerson: journal.stats.totalActualSpent / settings.numTravelers,
      breakdown: exportBudget,
    },

    route: {
      origin: endpoints.origin,
      destination: endpoints.destination,
      waypoints: summary.segments
        .map(s => s.to)
        .filter((loc, idx, arr) => arr.findIndex(l => l.name === loc.name) === idx),
    },

    recommendations: journal.entries.map(e => {
      const stop = resolveJournalEntryLocation(summary, e);
      return {
        location: stop?.name,
        lat: stop?.lat,
        lng: stop?.lng,
        rating: e.rating,
        notes: e.notes,
        isHighlight: e.isHighlight,
        highlightReason: e.highlightReason,
        wouldStayAgain: e.rating && e.rating >= 4,
        tips: e.notes,
      };
    }).filter(r => r.rating || r.isHighlight),

    // Include settings & vehicle so the plan can be fully loaded
    settings: {
      units: settings.units,
      currency: settings.currency,
      maxDriveHours: settings.maxDriveHours,
      numTravelers: settings.numTravelers,
      numDrivers: settings.numDrivers,
      isRoundTrip: settings.isRoundTrip,
      avoidTolls: settings.avoidTolls,
      avoidBorders: settings.avoidBorders,
      scenicMode: settings.scenicMode,
      routePreference: settings.routePreference,
      stopFrequency: settings.stopFrequency,
      gasPrice: settings.gasPrice,
      hotelPricePerNight: settings.hotelPricePerNight,
      mealPricePerDay: settings.mealPricePerDay,
    },

    vehicle: journal.vehicle,

    importInstructions: 'Load this template in My Experience Engine to follow the same route!',
  };

  const dataBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = journal.metadata.title
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 100) || 'untitled';
  link.download = `trip-template-${safeName}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast({
    message: 'Trip template downloaded! Share it so others can follow your route.',
    type: 'success',
    duration: 4000,
  });
}

/**
 * Export a planned trip (no journal required) as a shareable .json template.
 *
 * Produces the same SharedTemplate format as exportJournalAsTemplate so the
 * Step 1 "Load a MEE Time Template" importer can load it directly.
 *
 * All data comes from PrintInput — no extra props needed.
 * Pass an optional `journal` to include stop notes and memories when
 * `options.includeNotes` is enabled.
 *
 * TODO: Refactor — lineage not yet written here. PrintInput doesn't carry templateMeta
 * (tripOrigin isn't threaded through to this call site). Needs optional templateMeta
 * prop added to this function and wired from TripBottomActions/Step3CommitSection
 * before fork lineage will work for plan-mode exports.
 */
export function exportTripAsTemplate(printInput: PrintInput, options: ShareOptions = DEFAULT_SHARE_OPTIONS, journal?: TripJournal): void {
  const { summary, inputs: { locations, settings, vehicle } } = printInput;

  const endpoints = getTripDisplayEndpoints(summary);
  const destination = endpoints.destination?.name || 'Destination';
  const tripTitle = printInput.customTitle ?? buildAutoTitle({ destination });

  const originLoc = locations[0];
  const dest      = locations[locations.length - 1];
  const waypoints = locations.slice(1, -1);

  // Strip origin coords if user chose not to share starting location
  const origin = options.includeOrigin
    ? originLoc
    : { ...originLoc, name: '', lat: 0, lng: 0 };

  const template = {
    type: 'roadtrip-template' as const,
    version: '1.0',
    id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    author: 'MEE',

    trip: {
      title: tripTitle,
      description: 'Follow this route with My Experience Engine!',
      tags: [] as string[],
      durationDays: summary.drivingDays ?? 1,
      totalDistanceKm: Math.round(summary.totalDistanceKm),
      totalDurationHours: (summary.totalDurationMinutes / 60).toFixed(1),
    },

    ...(options.includeBudget && summary.costBreakdown ? {
      budget: {
        profile: settings.budget?.profile ?? 'balanced',
        totalSpent: summary.costBreakdown.total,
        perPerson: summary.costBreakdown.perPerson,
        breakdown: {
          fuel: summary.costBreakdown.fuel,
          accommodation: summary.costBreakdown.accommodation,
          food: summary.costBreakdown.meals,
          misc: summary.costBreakdown.misc,
        },
      },
    } : {}),

    route: { origin, destination: dest, waypoints },

    ...(options.includeNotes && journal ? {
      recommendations: journal.entries
        .filter(e => e.notes || e.rating || e.isHighlight)
        .map(e => {
          const seg = summary.segments[e.segmentIndex];
          return {
            location: seg?.to.name,
            lat: seg?.to.lat,
            lng: seg?.to.lng,
            rating: e.rating,
            notes: e.notes,
            isHighlight: e.isHighlight,
            highlightReason: e.highlightReason,
          };
        }),
      memories: journal.quickCaptures
        .filter(qc => qc.autoTaggedLocation || qc.photo)
        .map(qc => ({
          location: qc.autoTaggedLocation,
          category: qc.category,
          notes: qc.photo?.caption,
          gpsCoords: qc.gpsCoords,
        })),
    } : {}),

    settings: {
      units: settings.units,
      currency: settings.currency,
      maxDriveHours: settings.maxDriveHours,
      ...(options.includeTravelers ? { numTravelers: settings.numTravelers, numDrivers: settings.numDrivers } : {}),
      ...(options.includeDates ? { departureDate: settings.departureDate, returnDate: settings.returnDate } : {}),
      isRoundTrip: settings.isRoundTrip,
      avoidTolls: settings.avoidTolls,
      avoidBorders: settings.avoidBorders,
      scenicMode: settings.scenicMode,
      routePreference: settings.routePreference,
      stopFrequency: settings.stopFrequency,
      gasPrice: settings.gasPrice,
      hotelPricePerNight: settings.hotelPricePerNight,
      mealPricePerDay: settings.mealPricePerDay,
    },

    vehicle,

    importInstructions: 'Load this file in My Experience Engine (Step 1 → Load a MEE Time Template) to follow the same route.',
  };

  const dataBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  // eslint-disable-next-line no-control-regex
  const safeName = tripTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 100) || 'mee-time';
  link.download = `mee-time-${safeName}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast({
    message: 'MEE time saved! Share the .json so others can load your route.',
    type: 'success',
    duration: 4000,
  });
}

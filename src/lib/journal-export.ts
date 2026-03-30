import type { TripJournal } from '../types';
import { showToast } from './toast';
import { escapeHtml } from './utils';
import { getTripDisplayEndpoints } from './trip-summary-view';
import { resolveJournalEntryLocation } from './journal-trip-view';
import type { SegmentLookupSummary } from './trip-summary-slices';
import { JOURNAL_HTML_STYLES } from './journal-export-styles';

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

/**
 * trip-print-styles.ts — CSS for the print-optimized trip itinerary window.
 *
 * Injected into the popup window opened by printTrip().
 * Keep this file to CSS-only — no logic, no imports.
 */

export const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  @page {
    size: A4 portrait;
    margin: 14mm 16mm 14mm 16mm;
  }

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

  /* Event-based timeline (SmartTimeline style) */
  .event {
    display: flex;
    gap: 12px;
    padding: 6px 0;
    border-top: 1px dotted #e0e0e0;
    font-size: 10pt;
  }

  .event.first-event {
    border-top: none;
  }

  .event.departure, .event.arrival {
    background: #f0fff4;
  }

  .event.fuel {
    background: #fffbeb;
  }

  .event.meal {
    background: #eff6ff;
  }

  .event.combo {
    background: #fffbeb;
  }

  .event.destination {
    background: #ecfeff;
  }

  .event-time {
    width: 70px;
    flex-shrink: 0;
    font-weight: 700;
    color: #333;
    font-size: 10pt;
  }

  .event-body {
    flex: 1;
  }

  .event-emoji {
    margin-right: 6px;
  }

  .event-location {
    display: block;
    color: #666;
    font-size: 9pt;
    margin-top: 1px;
  }

  .event-header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
  }

  .event-header .event-location {
    display: inline;
    margin-left: 8px;
  }

  .event-timing {
    font-size: 9pt;
    color: #555;
    margin-top: 3px;
    font-family: ui-monospace, monospace;
  }

  .swap-annotation {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 8pt;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #3b82f6;
  }

  .driver-annotation {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 8pt;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #16a34a;
  }

  .time-saved {
    display: inline-block;
    background: #dcfce7;
    color: #166534;
    font-size: 8pt;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    margin-top: 3px;
  }

  .drive-connector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0 4px 78px;
    font-size: 9pt;
    color: #888;
  }

  .drive-arrow {
    color: #ccc;
  }

  .drive-info {
    font-family: ui-monospace, monospace;
    font-size: 8.5pt;
  }

  /* Legacy segment styles (fallback) */
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
    .cover-page { page-break-after: always; min-height: auto; }
    .driver-stats { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }

  /* ── Cover page (Page 1) ──────────────────────────────────────────────── */

  .cover-page {
    page-break-after: always;
    padding: 32px 24px;
    min-height: 100vh;
    box-sizing: border-box;
  }

  .cover-brand {
    margin-bottom: 20px;
  }

  .cover-brand-name {
    font-size: 7.5pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #bbb;
    font-weight: 600;
  }

  .cover-brand-tagline {
    font-size: 10.5pt;
    color: #333;
    font-weight: 400;
    letter-spacing: 0.03em;
    margin-top: 5px;
  }

  .cover-divider {
    border: none;
    border-top: 2px solid #e5e5e5;
    margin: 0 0 24px 0;
  }

  .cover-hero h1 {
    font-size: 26pt;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 0;
    letter-spacing: -0.01em;
  }

  .cover-subtitle {
    font-size: 12pt;
    color: #555;
    letter-spacing: 0.02em;
    margin-top: 7px;
    margin-bottom: 2px;
  }

  .cover-read {
    font-size: 11pt;
    color: #666;
    font-style: italic;
    margin-top: 12px;
    margin-bottom: 6px;
    padding-left: 12px;
    border-left: 2px solid #ddd;
    line-height: 1.65;
  }

  .cover-dates {
    font-size: 12pt;
    color: #555;
    margin-top: 7px;
    margin-bottom: 2px;
  }

  .cover-meta {
    font-size: 10pt;
    color: #777;
    margin-top: 8px;
  }

  .cover-section {
    margin-top: 22px;
  }

  .cover-section-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #999;
    font-weight: 700;
    margin-bottom: 10px;
  }

  .cover-status-card {
    padding: 14px 18px;
    border-radius: 8px;
    margin-top: 4px;
  }

  .cover-status-ok      { background: #f0fff4; border: 1px solid #86efac; }
  .cover-status-tight   { background: #fffbeb; border: 1px solid #fbbf24; }
  .cover-status-over    { background: #fef2f2; border: 1px solid #fca5a5; }
  .cover-status-neutral { background: #f5f5f5; border: 1px solid #e0e0e0; }

  .cover-status-headline {
    font-size: 13pt;
    font-weight: 700;
  }

  .cover-status-detail {
    font-size: 10pt;
    color: #555;
    margin-top: 5px;
  }

  .cover-warning-item {
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 8px;
    background: #fffbeb;
    border: 1px solid #fde68a;
  }

  .cover-warning-msg {
    font-size: 10.5pt;
    font-weight: 600;
  }

  .cover-warning-tip {
    font-size: 9.5pt;
    color: #666;
    margin-top: 3px;
  }

  .cover-pacing {
    font-size: 10.5pt;
    color: #333;
    margin-top: 4px;
    line-height: 1.8;
  }

  .beast-badge {
    display: inline-block;
    background: #fbbf24;
    color: #78350f;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 9.5pt;
    letter-spacing: 0.05em;
  }

  .cover-roster-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-top: 8px;
  }

  .cover-roster-table th,
  .cover-roster-table td {
    border: 1px solid #ddd;
    padding: 7px 12px;
    text-align: left;
  }

  .cover-roster-table th {
    background: #f9f9f9;
    font-weight: 600;
  }

  .cover-footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #eee;
    font-size: 8pt;
    color: #bbb;
  }

  /* ── Journal section ────────────────────────────────────────────────────── */

  .journal-section {
    margin-top: 10px;
    padding: 10px 12px;
    background: #faf7ff;
    border: 1px solid #e0d7f5;
    border-radius: 6px;
    page-break-inside: avoid;
  }

  .journal-section-label {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #7c3aed;
    margin-bottom: 8px;
  }

  .journal-entry {
    margin-bottom: 8px;
  }

  .journal-notes {
    font-size: 9.5pt;
    color: #333;
    font-style: italic;
    margin-bottom: 6px;
    line-height: 1.5;
  }

  .journal-rating {
    color: #f59e0b;
    font-size: 10pt;
    display: block;
    margin-bottom: 3px;
  }

  .journal-photos {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  .journal-photo {
    margin: 0;
    flex: 0 0 auto;
  }

  .journal-photo img {
    max-width: 180px;
    max-height: 130px;
    width: auto;
    height: auto;
    border-radius: 4px;
    border: 1px solid #ddd;
    display: block;
  }

  .journal-photo figcaption {
    font-size: 8pt;
    color: #666;
    margin-top: 3px;
    max-width: 180px;
    font-style: italic;
  }

  .journal-captures {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 6px;
  }

  .capture-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
  }

  .capture-photo img {
    max-width: 140px;
    max-height: 110px;
    width: auto;
    height: auto;
    border-radius: 4px;
    border: 1px solid #c4b5fd;
    display: block;
  }

  .capture-time {
    font-size: 7.5pt;
    color: #7c3aed;
    font-family: ui-monospace, monospace;
  }

  /* Itinerary section header (top of Page 2) */
  .itinerary-header {
    font-size: 13pt;
    font-weight: 700;
    color: #444;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #333;
  }
`;

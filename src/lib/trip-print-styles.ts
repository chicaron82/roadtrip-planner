/**
 * trip-print-styles.ts — CSS for the print-optimized trip itinerary window.
 *
 * Injected into the popup window opened by printTrip().
 * Keep this file to CSS-only — no logic, no imports.
 */

export const PRINT_STYLES = `
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
  }
`;

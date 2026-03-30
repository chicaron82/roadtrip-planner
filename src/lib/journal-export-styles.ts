/**
 * journal-export-styles.ts — Print stylesheet for journal HTML export.
 *
 * Pure CSS string. Separated from journal-export.ts to keep build logic
 * and styling concerns in distinct files.
 *
 * 💚 My Experience Engine
 */

export const JOURNAL_HTML_STYLES = `
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

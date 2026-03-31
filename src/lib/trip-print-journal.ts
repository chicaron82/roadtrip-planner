import type { JournalEntry, QuickCapture } from '../types';
import { escapeHtml } from './utils';

// ── Journal section HTML builder ─────────────────────────────────────────────

export function buildJournalHTML(entries?: JournalEntry[], captures?: QuickCapture[]): string {
  const hasEntries = entries && entries.some(e => e.notes || e.photos.length > 0);
  const hasCaptures = captures && captures.length > 0;
  if (!hasEntries && !hasCaptures) return '';

  const parts: string[] = [];

  if (hasEntries) {
    for (const entry of entries!) {
      if (!entry.notes && entry.photos.length === 0) continue;
      const photosHTML = entry.photos.length > 0
        ? `<div class="journal-photos">${entry.photos.map(p => `
            <figure class="journal-photo">
              <img src="${p.dataUrl}" alt="${escapeHtml(p.caption || '')}" />
              ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
            </figure>`).join('')}</div>`
        : '';
      const ratingHTML = entry.rating ? `<span class="journal-rating">${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}</span>` : '';
      parts.push(`
        <div class="journal-entry">
          ${ratingHTML}
          ${entry.notes ? `<p class="journal-notes">${escapeHtml(entry.notes)}</p>` : ''}
          ${photosHTML}
        </div>`);
    }
  }

  if (hasCaptures) {
    const captureItems = captures!.map(qc => {
      const timeStr = new Date(qc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const photoHTML = qc.photo
        ? `<figure class="journal-photo capture-photo">
            <img src="${qc.photo.dataUrl}" alt="${escapeHtml(qc.photo.caption || '')}" />
            ${qc.photo.caption ? `<figcaption>${escapeHtml(qc.photo.caption)}</figcaption>` : ''}
           </figure>`
        : '';
      const location = qc.autoTaggedLocation ? ` · ${escapeHtml(qc.autoTaggedLocation)}` : '';
      return `<div class="capture-item">${photoHTML}<span class="capture-time">${timeStr}${location}</span></div>`;
    }).join('');
    parts.push(`<div class="journal-captures">${captureItems}</div>`);
  }

  return `<div class="journal-section"><div class="journal-section-label">📔 Journal</div>${parts.join('')}</div>`;
}

import type { TripJournal, TripTemplate } from '../../types';
import { openDB, STORES } from './db';
import { determineBudgetLevel, extractLocations, getStopName } from './helpers';

/**
 * Export journal as JSON template
 */
export function exportJournalAsTemplate(journal: TripJournal): TripTemplate {
  const template: TripTemplate = {
    id: `template-${Date.now()}`,
    version: '1.0',
    author: journal.metadata.travelers?.[0],
    createdAt: new Date(),
    metadata: {
      title: journal.metadata.title,
      description: journal.metadata.description || '',
      tags: journal.metadata.tags,
      budgetLevel: determineBudgetLevel(journal.settings.budget.total),
      durationDays: journal.tripSummary.drivingDays || 1,
      totalDistanceKm: journal.tripSummary.totalDistanceKm,
    },
    route: {
      locations: extractLocations(journal.tripSummary),
      origin: journal.tripSummary.segments[0]?.from,
      destination: journal.tripSummary.segments[journal.tripSummary.segments.length - 1]?.to,
    },
    budgetEstimates: journal.settings.budget,
  };

  // Include highlights if sharing settings allow
  if (journal.sharing.includePhotos) {
    template.highlights = journal.entries
      .filter(e => e.isHighlight)
      .map(e => ({
        stopName: getStopName(journal, e.segmentIndex),
        reason: e.highlightReason || '',
        photoUrl: e.photos[0]?.dataUrl,
      }));
  }

  return template;
}

/**
 * Export journal as JSON string
 */
export function exportJournalToJSON(journal: TripJournal): string {
  // Strip photos if privacy doesn't allow
  const exportJournal = { ...journal };

  if (!journal.sharing.includePhotos) {
    exportJournal.entries = journal.entries.map(e => ({ ...e, photos: [] }));
    exportJournal.quickCaptures = [];
  }

  if (!journal.sharing.includeNotes) {
    exportJournal.entries = exportJournal.entries.map(e => ({ ...e, notes: '' }));
  }

  if (!journal.sharing.includeBudget) {
    exportJournal.budgetActuals = [];
  }

  return JSON.stringify(exportJournal, null, 2);
}

/**
 * Import journal from JSON
 */
export async function importJournalFromJSON(json: string): Promise<TripJournal> {
  const parsed = JSON.parse(json) as TripJournal;

  // Generate new ID to avoid conflicts
  parsed.id = `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  parsed.createdAt = new Date();
  parsed.updatedAt = new Date();

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.JOURNALS, 'readwrite');
    const store = tx.objectStore(STORES.JOURNALS);
    const request = store.add(parsed);

    request.onsuccess = () => resolve(parsed);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import template and create pre-filled trip
 */
export function importTemplate(template: TripTemplate): {
  locations: typeof template.route.locations;
  budget: typeof template.budgetEstimates;
  preferences: typeof template.metadata.tags;
} {
  return {
    locations: template.route.locations,
    budget: template.budgetEstimates,
    preferences: template.metadata.tags,
  };
}

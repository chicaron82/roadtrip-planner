import type {
  TripJournal,
  TripSummary,
  TripSettings,
  Vehicle,
} from '../../types';
import { openDB, STORES } from './db';
import { generateDefaultTitle, computeJournalStats } from './helpers';

/**
 * Create a new journal from a trip plan
 */
export async function createJournal(
  tripSummary: TripSummary,
  settings: TripSettings,
  vehicle: Vehicle,
  title?: string,
  origin?: import('../../types').TripOrigin
): Promise<TripJournal> {
  const db = await openDB();
  const id = `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const journal: TripJournal = {
    id,
    version: '1.0',
    origin,
    tripSummary,
    settings,
    vehicle,
    entries: [],
    quickCaptures: [],
    dayMeta: [],
    budgetActuals: [],
    metadata: {
      title: title || generateDefaultTitle(tripSummary),
      tags: settings.tripPreferences,
      dates: {
        plannedStart: settings.departureDate,
        plannedEnd: settings.arrivalDate || settings.departureDate,
      },
    },
    sharing: {
      privacy: 'private',
      isPublic: false,
      includePhotos: true,
      includeBudget: true,
      includeNotes: true,
    },
    sync: {
      status: 'synced',
      lastSynced: new Date(),
      pendingChanges: 0,
    },
    stats: {
      photosCount: 0,
      highlightsCount: 0,
      stopsVisited: 0,
      stopsSkipped: 0,
      totalActualSpent: 0,
      budgetVariance: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.JOURNALS, 'readwrite');
    const store = tx.objectStore(STORES.JOURNALS);
    const request = store.add(journal);

    request.onsuccess = () => resolve(journal);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a journal by ID
 */
export async function getJournal(id: string): Promise<TripJournal | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.JOURNALS, 'readonly');
    const store = tx.objectStore(STORES.JOURNALS);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all journals
 */
export async function getAllJournals(): Promise<TripJournal[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.JOURNALS, 'readonly');
    const store = tx.objectStore(STORES.JOURNALS);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by updatedAt descending
      const journals = request.result as TripJournal[];
      journals.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(journals);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a journal
 */
export async function updateJournal(journal: TripJournal): Promise<TripJournal> {
  const db = await openDB();

  // Update stats and timestamp
  journal.updatedAt = new Date();
  journal.stats = computeJournalStats(journal);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.JOURNALS, 'readwrite');
    const store = tx.objectStore(STORES.JOURNALS);
    const request = store.put(journal);

    request.onsuccess = () => resolve(journal);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a journal
 */
export async function deleteJournal(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.JOURNALS, 'readwrite');
    const store = tx.objectStore(STORES.JOURNALS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

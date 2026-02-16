import type {
  TripJournal,
  JournalEntry,
  JournalPhoto,
  BudgetActual,
  QuickCapture,
  JournalDayMeta,
  TripTemplate,
  TripSummary,
  TripSettings,
  Vehicle,
} from '../types';

const DB_NAME = 'roadtrip-journal';
const DB_VERSION = 1;

// Store names
const STORES = {
  JOURNALS: 'journals',
  PHOTOS: 'photos', // Separate store for large photo blobs
  TEMPLATES: 'templates',
} as const;

// ==================== DATABASE SETUP ====================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Journals store
      if (!db.objectStoreNames.contains(STORES.JOURNALS)) {
        const journalStore = db.createObjectStore(STORES.JOURNALS, { keyPath: 'id' });
        journalStore.createIndex('createdAt', 'createdAt');
        journalStore.createIndex('updatedAt', 'updatedAt');
      }

      // Photos store (separate for better performance)
      if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
        const photoStore = db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
        photoStore.createIndex('journalId', 'journalId');
      }

      // Templates store
      if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
        const templateStore = db.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' });
        templateStore.createIndex('createdAt', 'createdAt');
      }
    };
  });

  return dbPromise;
}

// ==================== JOURNAL CRUD ====================

/**
 * Create a new journal from a trip plan
 */
export async function createJournal(
  tripSummary: TripSummary,
  settings: TripSettings,
  vehicle: Vehicle,
  title?: string
): Promise<TripJournal> {
  const db = await openDB();
  const id = `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const journal: TripJournal = {
    id,
    version: '1.0',
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

// ==================== JOURNAL ENTRY HELPERS ====================

/**
 * Add or update a journal entry
 */
export async function upsertJournalEntry(
  journalId: string,
  entry: JournalEntry
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  const existingIndex = journal.entries.findIndex(e => e.id === entry.id);
  if (existingIndex >= 0) {
    journal.entries[existingIndex] = { ...entry, updatedAt: new Date() };
  } else {
    journal.entries.push({ ...entry, createdAt: new Date(), updatedAt: new Date() });
  }

  return updateJournal(journal);
}

/**
 * Add a quick capture
 */
export async function addQuickCapture(
  journalId: string,
  capture: QuickCapture
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  journal.quickCaptures.push(capture);
  return updateJournal(journal);
}

/**
 * Add a budget actual entry
 */
export async function addBudgetActual(
  journalId: string,
  actual: BudgetActual
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  journal.budgetActuals.push(actual);
  return updateJournal(journal);
}

/**
 * Update day metadata (title, mood)
 */
export async function updateDayMeta(
  journalId: string,
  dayMeta: JournalDayMeta
): Promise<TripJournal> {
  const journal = await getJournal(journalId);
  if (!journal) throw new Error(`Journal ${journalId} not found`);

  const existingIndex = journal.dayMeta.findIndex(d => d.dayNumber === dayMeta.dayNumber);
  if (existingIndex >= 0) {
    journal.dayMeta[existingIndex] = dayMeta;
  } else {
    journal.dayMeta.push(dayMeta);
  }

  return updateJournal(journal);
}

// ==================== PHOTO COMPRESSION ====================

const MAX_PHOTO_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Compress an image file to a smaller data URL
 */
export async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if too wide
        if (width > MAX_PHOTO_WIDTH) {
          height = (height * MAX_PHOTO_WIDTH) / width;
          width = MAX_PHOTO_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Create a JournalPhoto from a file
 */
export async function createPhotoFromFile(
  file: File,
  caption: string = ''
): Promise<JournalPhoto> {
  const dataUrl = await compressPhoto(file);

  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    dataUrl,
    caption,
    timestamp: new Date(),
  };
}

// ==================== EXPORT / IMPORT ====================

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

// ==================== HELPER FUNCTIONS ====================

function generateDefaultTitle(summary: TripSummary): string {
  const origin = summary.segments[0]?.from.name.split(',')[0] || 'Start';
  const dest = summary.segments[summary.segments.length - 1]?.to.name.split(',')[0] || 'Destination';
  return `${origin} to ${dest}`;
}

function computeJournalStats(journal: TripJournal): TripJournal['stats'] {
  const photosCount = journal.entries.reduce((sum, e) => sum + e.photos.length, 0) +
    journal.quickCaptures.length;

  const highlightsCount = journal.entries.filter(e => e.isHighlight).length;
  const stopsVisited = journal.entries.filter(e => e.status === 'visited').length;
  const stopsSkipped = journal.entries.filter(e => e.status === 'skipped').length;

  const totalActualSpent = journal.budgetActuals.reduce((sum, a) => sum + a.actual, 0);
  const totalPlanned = journal.budgetActuals.reduce((sum, a) => sum + a.planned, 0);
  const budgetVariance = totalActualSpent - totalPlanned;

  return {
    photosCount,
    highlightsCount,
    stopsVisited,
    stopsSkipped,
    totalActualSpent,
    budgetVariance,
  };
}

function determineBudgetLevel(total: number): 'budget' | 'moderate' | 'comfort' {
  if (total < 500) return 'budget';
  if (total < 1500) return 'moderate';
  return 'comfort';
}

function extractLocations(summary: TripSummary): TripTemplate['route']['locations'] {
  const locations = [summary.segments[0]?.from];

  // Add unique waypoints
  summary.segments.forEach(seg => {
    if (!locations.find(l => l.id === seg.to.id)) {
      locations.push(seg.to);
    }
  });

  return locations.filter(Boolean);
}

function getStopName(journal: TripJournal, segmentIndex: number): string {
  const segment = journal.tripSummary.segments[segmentIndex];
  return segment?.to.name.split(',')[0] || `Stop ${segmentIndex + 1}`;
}

// ==================== ACTIVE JOURNAL TRACKING ====================

const ACTIVE_JOURNAL_KEY = 'active-journal-id';

/**
 * Set the currently active journal (for the ongoing trip)
 */
export function setActiveJournalId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_JOURNAL_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_JOURNAL_KEY);
  }
}

/**
 * Get the currently active journal ID
 */
export function getActiveJournalId(): string | null {
  return localStorage.getItem(ACTIVE_JOURNAL_KEY);
}

/**
 * Get the active journal (if any)
 */
export async function getActiveJournal(): Promise<TripJournal | null> {
  const id = getActiveJournalId();
  if (!id) return null;
  return getJournal(id);
}

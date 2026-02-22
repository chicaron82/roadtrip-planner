export const DB_NAME = 'roadtrip-journal';
export const DB_VERSION = 1;

// Store names
export const STORES = {
  JOURNALS: 'journals',
  PHOTOS: 'photos', // Separate store for large photo blobs
  TEMPLATES: 'templates',
} as const;

// ==================== DATABASE SETUP ====================

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
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

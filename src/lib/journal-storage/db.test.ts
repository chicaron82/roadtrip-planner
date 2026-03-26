import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---
class MockIDBOpenDBRequest {
  public onerror: ((ev: Event) => void) | null = null;
  public onsuccess: ((ev: Event) => void) | null = null;
  public onupgradeneeded: ((ev: unknown) => void) | null = null;
  public result: unknown;
  public error: unknown;

  triggerSuccess(db: unknown) {
    this.result = db;
    if (this.onsuccess) this.onsuccess(new Event('success'));
  }
  
  triggerUpgradeNeeded(db: unknown) {
    this.result = db;
    if (this.onupgradeneeded) {
      this.onupgradeneeded({ target: { result: db } });
    }
  }

  triggerError(err: Error) {
    this.error = err;
    if (this.onerror) this.onerror(new Event('error'));
  }
}

const mockIndexedDB = {
  open: vi.fn(),
};

describe('Journal Offline Storage (IndexedDB)', () => {
  let requestMock: MockIDBOpenDBRequest;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', mockIndexedDB);
    requestMock = new MockIDBOpenDBRequest();
    mockIndexedDB.open.mockReturnValue(requestMock);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('openDB', () => {
    it('returns a resolved promise if DB opens successfully', async () => {
      const { openDB, DB_NAME, DB_VERSION } = await import('./db');
      const mockDB = { name: 'TestDB' };
      
      const promise = openDB();
      requestMock.triggerSuccess(mockDB);
      
      const db = await promise;
      expect(db).toBe(mockDB);
      expect(mockIndexedDB.open).toHaveBeenCalledWith(DB_NAME, DB_VERSION);
    });

    it('creates journals, photos, and templates stores on upgradeneeded', async () => {
      const { openDB, STORES } = await import('./db');
      
      const journalStoreMock = { createIndex: vi.fn() };
      const photoStoreMock = { createIndex: vi.fn() };
      const templateStoreMock = { createIndex: vi.fn() };
      
      const dbMock = {
        objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
        createObjectStore: vi.fn((name) => {
          if (name === STORES.JOURNALS) return journalStoreMock;
          if (name === STORES.PHOTOS) return photoStoreMock;
          if (name === STORES.TEMPLATES) return templateStoreMock;
        })
      };
      
      const promise = openDB();
      requestMock.triggerUpgradeNeeded(dbMock);
      requestMock.triggerSuccess(dbMock);
      
      await promise;
      
      expect(dbMock.createObjectStore).toHaveBeenCalledWith(STORES.JOURNALS, { keyPath: 'id' });
      expect(dbMock.createObjectStore).toHaveBeenCalledWith(STORES.PHOTOS, { keyPath: 'id' });
      expect(dbMock.createObjectStore).toHaveBeenCalledWith(STORES.TEMPLATES, { keyPath: 'id' });
      
      expect(journalStoreMock.createIndex).toHaveBeenCalledWith('createdAt', 'createdAt');
      expect(journalStoreMock.createIndex).toHaveBeenCalledWith('updatedAt', 'updatedAt');
      expect(photoStoreMock.createIndex).toHaveBeenCalledWith('journalId', 'journalId');
      expect(templateStoreMock.createIndex).toHaveBeenCalledWith('createdAt', 'createdAt');
    });

    it('rejects if IDB open request fails', async () => {
      const { openDB } = await import('./db');
      const mockError = new Error('IDB blocked');
      
      const promise = openDB();
      requestMock.triggerError(mockError);
      
      await expect(promise).rejects.toThrow('IDB blocked');
    });
  });
});

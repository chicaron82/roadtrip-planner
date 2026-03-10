/**
 * journal-storage test suite
 *
 * Coverage:
 *   helpers.ts       — pure functions, no mocking
 *   active.ts        — localStorage (mocked in test/setup.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  TripJournal,
  JournalEntry,
  QuickCapture,
  BudgetActual,
} from '../../types';
import { makeSettings, makeSummary, makeSegment } from '../../test/fixtures';

// vi.mock is hoisted — applies when helpers/active import from ./crud
vi.mock('./crud', () => ({
  getJournal: vi.fn(),
  updateJournal: vi.fn(),
}));

import { generateDefaultTitle, computeJournalStats, determineBudgetLevel, extractLocations, getStopName } from './helpers';
import { setActiveJournalId, getActiveJournalId, getActiveJournal } from './active';
import { getJournal } from './crud';

const mockGetJournal = vi.mocked(getJournal);

// ==================== FACTORIES ====================

function makeJournal(overrides: Partial<TripJournal> = {}): TripJournal {
  const seg = makeSegment({
    from: { id: 'loc-winnipeg', name: 'Winnipeg, MB', lat: 49.8, lng: -97.1, type: 'origin' },
    to: { id: 'loc-thunder-bay', name: 'Thunder Bay, ON', lat: 48.4, lng: -89.2, type: 'destination' },
  });
  return {
    id: 'journal-123',
    version: '1.0',
    tripSummary: makeSummary({ segments: [seg], totalDistanceKm: 500 }),
    settings: makeSettings(),
    vehicle: { year: 2020, make: 'Toyota', model: 'Camry', cityFuelL100km: 10, hwyFuelL100km: 7, tankSizeLitres: 60 } as any,
    entries: [],
    quickCaptures: [],
    dayMeta: [],
    budgetActuals: [],
    metadata: {
      title: 'Winnipeg to Thunder Bay',
      tags: [],
      dates: { plannedStart: '2025-08-16', plannedEnd: '2025-08-18' },
    },
    sharing: {
      privacy: 'private',
      isPublic: false,
      includePhotos: true,
      includeNotes: true,
      includeBudget: true,
    },
    sync: { status: 'synced', lastSynced: null, pendingChanges: 0 },
    stats: { photosCount: 0, highlightsCount: 0, stopsVisited: 0, stopsSkipped: 0, totalActualSpent: 0, budgetVariance: 0 },
    createdAt: new Date('2025-08-16'),
    updatedAt: new Date('2025-08-16'),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    stopId: 'loc-thunder-bay',
    segmentIndex: 0,
    status: 'planned',
    photos: [],
    isHighlight: false,
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ==================== helpers.ts ====================

describe('generateDefaultTitle', () => {
  it('builds a title from first origin and last destination', () => {
    const seg = makeSegment({
      from: { id: 'a', name: 'Winnipeg, MB', lat: 49.8, lng: -97.1, type: 'origin' },
      to: { id: 'b', name: 'Thunder Bay, ON', lat: 48.4, lng: -89.2, type: 'destination' },
    });
    expect(generateDefaultTitle(makeSummary({ segments: [seg] }))).toBe('Winnipeg to Thunder Bay');
  });

  it('strips province suffix after the comma', () => {
    const seg = makeSegment({
      from: { id: 'a', name: 'Vancouver, BC', lat: 49.2, lng: -123.1, type: 'origin' },
      to: { id: 'b', name: 'Whistler, BC', lat: 50.1, lng: -122.9, type: 'destination' },
    });
    expect(generateDefaultTitle(makeSummary({ segments: [seg] }))).toBe('Vancouver to Whistler');
  });

  it('falls back to Start / Destination when segments are empty', () => {
    expect(generateDefaultTitle(makeSummary({ segments: [] }))).toBe('Start to Destination');
  });
});

describe('computeJournalStats', () => {
  it('returns all-zero stats for an empty journal', () => {
    const stats = computeJournalStats(makeJournal());
    expect(stats).toEqual({ photosCount: 0, highlightsCount: 0, stopsVisited: 0, stopsSkipped: 0, totalActualSpent: 0, budgetVariance: 0 });
  });

  it('counts photos from entry photo arrays', () => {
    const entry = makeEntry({ photos: [{ id: 'p1', dataUrl: '', timestamp: new Date(), caption: '' }] });
    expect(computeJournalStats(makeJournal({ entries: [entry] })).photosCount).toBe(1);
  });

  it('counts quick captures toward photosCount', () => {
    const capture: QuickCapture = { id: 'qc-1', timestamp: new Date() };
    expect(computeJournalStats(makeJournal({ quickCaptures: [capture] })).photosCount).toBe(1);
  });

  it('sums photos from entries and quick captures together', () => {
    const entry = makeEntry({ photos: [{ id: 'p1', dataUrl: '', timestamp: new Date(), caption: '' }, { id: 'p2', dataUrl: '', timestamp: new Date(), caption: '' }] });
    const capture: QuickCapture = { id: 'qc-1', timestamp: new Date() };
    expect(computeJournalStats(makeJournal({ entries: [entry], quickCaptures: [capture] })).photosCount).toBe(3);
  });

  it('counts highlights', () => {
    const entries = [
      makeEntry({ id: 'e1', stopId: 'a', isHighlight: true }),
      makeEntry({ id: 'e2', stopId: 'b', isHighlight: false }),
      makeEntry({ id: 'e3', stopId: 'c', isHighlight: true }),
    ];
    expect(computeJournalStats(makeJournal({ entries })).highlightsCount).toBe(2);
  });

  it('counts visited and skipped stops independently', () => {
    const entries = [
      makeEntry({ id: 'e1', stopId: 'a', status: 'visited' }),
      makeEntry({ id: 'e2', stopId: 'b', status: 'visited' }),
      makeEntry({ id: 'e3', stopId: 'c', status: 'skipped' }),
    ];
    const stats = computeJournalStats(makeJournal({ entries }));
    expect(stats.stopsVisited).toBe(2);
    expect(stats.stopsSkipped).toBe(1);
  });

  it('computes totalActualSpent as sum of all actuals', () => {
    const budgetActuals: BudgetActual[] = [
      { id: 'b1', category: 'gas', planned: 100, actual: 80, dayNumber: 1, timestamp: new Date() },
      { id: 'b2', category: 'hotel', planned: 100, actual: 170, dayNumber: 1, timestamp: new Date() },
    ];
    expect(computeJournalStats(makeJournal({ budgetActuals })).totalActualSpent).toBe(250);
  });

  it('reports positive budgetVariance when over budget', () => {
    const budgetActuals: BudgetActual[] = [
      { id: 'b1', category: 'misc', planned: 50, actual: 100, dayNumber: 1, timestamp: new Date() },
    ];
    expect(computeJournalStats(makeJournal({ budgetActuals })).budgetVariance).toBe(50);
  });

  it('reports negative budgetVariance when under budget', () => {
    const budgetActuals: BudgetActual[] = [
      { id: 'b1', category: 'food', planned: 200, actual: 150, dayNumber: 1, timestamp: new Date() },
    ];
    expect(computeJournalStats(makeJournal({ budgetActuals })).budgetVariance).toBe(-50);
  });
});

describe('determineBudgetLevel', () => {
  it('returns budget for totals under 500', () => {
    expect(determineBudgetLevel(0)).toBe('budget');
    expect(determineBudgetLevel(499)).toBe('budget');
  });

  it('returns moderate for totals between 500 and 1499', () => {
    expect(determineBudgetLevel(500)).toBe('moderate');
    expect(determineBudgetLevel(1000)).toBe('moderate');
    expect(determineBudgetLevel(1499)).toBe('moderate');
  });

  it('returns comfort for totals 1500 and above', () => {
    expect(determineBudgetLevel(1500)).toBe('comfort');
    expect(determineBudgetLevel(9999)).toBe('comfort');
  });
});

describe('extractLocations', () => {
  it('includes origin and destination from a single segment', () => {
    const seg = makeSegment({
      from: { id: 'a', name: 'A', lat: 0, lng: 0, type: 'origin' },
      to: { id: 'b', name: 'B', lat: 1, lng: 1, type: 'destination' },
    });
    const locations = extractLocations(makeSummary({ segments: [seg] }));
    expect(locations.map(l => l.id)).toEqual(['a', 'b']);
  });

  it('deduplicates shared waypoints across segments', () => {
    const mid = { id: 'mid', name: 'Mid', lat: 1, lng: 1, type: 'waypoint' as const };
    const seg1 = makeSegment({ from: { id: 'a', name: 'A', lat: 0, lng: 0, type: 'origin' }, to: mid });
    const seg2 = makeSegment({ from: mid, to: { id: 'c', name: 'C', lat: 2, lng: 2, type: 'destination' } });
    const locations = extractLocations(makeSummary({ segments: [seg1, seg2] }));
    expect(locations.map(l => l.id)).toEqual(['a', 'mid', 'c']);
  });
});

describe('getStopName', () => {
  it('returns destination city name without province suffix', () => {
    expect(getStopName(makeJournal(), 0)).toBe('Thunder Bay');
  });

  it('falls back to Stop N+1 for an out-of-range segment index', () => {
    expect(getStopName(makeJournal(), 99)).toBe('Stop 100');
  });
});

// ==================== active.ts ====================

describe('setActiveJournalId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores the journal ID in localStorage', () => {
    setActiveJournalId('journal-abc');
    expect(localStorage.setItem).toHaveBeenCalledWith('active-journal-id', 'journal-abc');
  });

  it('removes the localStorage key when called with null', () => {
    setActiveJournalId(null);
    expect(localStorage.removeItem).toHaveBeenCalledWith('active-journal-id');
  });
});

describe('getActiveJournalId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the stored value from localStorage', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('journal-xyz');
    expect(getActiveJournalId()).toBe('journal-xyz');
  });

  it('returns null when localStorage has no active journal', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    expect(getActiveJournalId()).toBeNull();
  });
});

describe('getActiveJournal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null immediately when no active journal ID is stored', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    await expect(getActiveJournal()).resolves.toBeNull();
  });

  it('fetches and returns the journal by its active ID', async () => {
    const journal = makeJournal();
    vi.mocked(localStorage.getItem).mockReturnValue(journal.id);
    mockGetJournal.mockResolvedValue(journal);
    await expect(getActiveJournal()).resolves.toEqual(journal);
    expect(mockGetJournal).toHaveBeenCalledWith(journal.id);
  });
});

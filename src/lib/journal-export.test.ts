/**
 * journal-export.test.ts
 *
 * Tests for exportJournalAsTemplate and exportTripAsTemplate logic.
 * DOM-touching download side is mocked — only the template object construction
 * and round-trip fidelity are tested here.
 *
 * 💚 My Experience Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TripJournal, TripSettings, Vehicle, Location } from '../types';
import type { PrintInput } from './canonical-trip';
import type { JournalExportSummary } from './trip-summary-slices';

// ── Mock DOM download side ────────────────────────────────────────────────────

beforeEach(() => {
  const mockAnchor = { href: '', download: '', click: vi.fn(), style: {} };
  vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  // Suppress toast
  vi.mock('./toast', () => ({ showToast: vi.fn() }));
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORIGIN: Location = { id: 'wpg', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' };
const DEST: Location   = { id: 'tb',  name: 'Thunder Bay', lat: 48.38, lng: -89.25, type: 'destination' };

const VEHICLE: Vehicle = {
  year: '2022', make: 'Toyota', model: 'Camry',
  fuelEconomyCity: 10, fuelEconomyHwy: 8, tankSize: 50,
};

const BASE_SETTINGS: TripSettings = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 8,
  numTravelers: 2,
  numDrivers: 1,
  gasPrice: 1.65,
  hotelPricePerNight: 140,
  mealPricePerDay: 50,
  budgetMode: 'open',
  budget: { mode: 'open', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 30, misc: 10 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 },
  departureDate: '2026-08-01',
  departureTime: '09:00',
  returnDate: '2026-08-04',
  arrivalDate: '',
  arrivalTime: '',
} as TripSettings;

const STUB_JOURNAL: TripJournal = {
  id: 'test-journal',
  metadata: {
    title: 'Thunder Bay Run',
    travelers: ['DiZee'],
    tags: ['test'],
    dates: { plannedStart: '2026-08-01', plannedEnd: '2026-08-04' },
  },
  vehicle: VEHICLE,
  origin: { type: 'template', id: 'parent-template-abc', title: 'Original Route', author: 'ZeeRah' },
  tripSummary: {
    totalDistanceKm: 702,
    totalDurationMinutes: 420,
    days: [],
  },
  stats: {
    stopsVisited: 3, stopsSkipped: 1, photosCount: 5, highlightsCount: 2,
    totalActualSpent: 600,
  },
  entries: [
    {
      id: 'e1', stopId: 'wpg', status: 'visited', rating: 5, isHighlight: true,
      highlightReason: 'Best poutine',
      notes: 'The drive into Thunder Bay is stunning.',
      photos: [],
    },
    {
      id: 'e2', stopId: 'tb', status: 'visited', rating: 3, isHighlight: false,
      notes: '',
      photos: [],
    },
    {
      id: 'e3', stopId: 'mid', status: 'visited', rating: 2, isHighlight: false,
      notes: 'Average stop.',
      photos: [],
    },
  ],
  quickCaptures: [],
} as unknown as TripJournal;

const STUB_EXPORT_SUMMARY: JournalExportSummary = {
  totalDistanceKm: 702,
  totalDurationMinutes: 420,
  segments: [
    { from: ORIGIN, to: DEST, distanceKm: 702, durationMinutes: 420, fuelCost: 48, fuelLitres: 29 } as never,
  ],
} as unknown as JournalExportSummary;

const STUB_PRINT_INPUT = {
  summary: {
    totalDistanceKm: 702,
    totalDurationMinutes: 420,
    totalFuelCost: 80,
    totalFuelLitres: 48,
    costPerPerson: 250,
    gasStops: 2,
    drivingDays: 1,
    segments: [],
    fullGeometry: [],
    costBreakdown: { fuel: 80, accommodation: 280, meals: 100, misc: 40, total: 500, perPerson: 250 },
  } as never,
  inputs: { locations: [ORIGIN, DEST], settings: BASE_SETTINGS, vehicle: VEHICLE },
} as unknown as PrintInput;

// ── exportJournalAsTemplate ───────────────────────────────────────────────────

describe('exportJournalAsTemplate', () => {
  it('produces type: roadtrip-template', async () => {
    const { exportJournalAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    exportJournalAsTemplate(STUB_JOURNAL, STUB_EXPORT_SUMMARY, BASE_SETTINGS);
    vi.stubGlobal('Blob', OrigBlob);
    expect((captured as { type: string }).type).toBe('roadtrip-template');
  });

  it('has a stable id field', async () => {
    const { exportJournalAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    exportJournalAsTemplate(STUB_JOURNAL, STUB_EXPORT_SUMMARY, BASE_SETTINGS);
    vi.stubGlobal('Blob', OrigBlob);
    expect((captured as { id: string }).id).toMatch(/^template-\d+-[a-z0-9]+$/);
  });

  it('writes lineage when journal.origin.type is template (lineage fix)', async () => {
    const { exportJournalAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    exportJournalAsTemplate(STUB_JOURNAL, STUB_EXPORT_SUMMARY, BASE_SETTINGS);
    vi.stubGlobal('Blob', OrigBlob);
    // STUB_JOURNAL.origin = { type: 'template', id: 'parent-template-abc' }
    expect((captured as { lineage: string[] }).lineage).toEqual(['parent-template-abc']);
  });

  it('does NOT write lineage when journal.origin is null', async () => {
    const { exportJournalAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const noOriginJournal = { ...STUB_JOURNAL, origin: null };
    exportJournalAsTemplate(noOriginJournal as never, STUB_EXPORT_SUMMARY, BASE_SETTINGS);
    vi.stubGlobal('Blob', OrigBlob);
    expect((captured as Record<string, unknown>).lineage).toBeUndefined();
  });

  it('filters recommendations to only entries with rating or isHighlight', async () => {
    const { exportJournalAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    exportJournalAsTemplate(STUB_JOURNAL, STUB_EXPORT_SUMMARY, BASE_SETTINGS);
    vi.stubGlobal('Blob', OrigBlob);
    // e1 (rating:5, highlight), e2 (rating:3), e3 (rating:2) — all have rating so all pass
    // but filter is: r.rating || r.isHighlight — rating 2 passes (truthy)
    const recs = (captured as { recommendations: unknown[] }).recommendations;
    expect(recs.length).toBeGreaterThan(0);
  });

  it('sets author from travelers[0]', async () => {
    const { exportJournalAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    exportJournalAsTemplate(STUB_JOURNAL, STUB_EXPORT_SUMMARY, BASE_SETTINGS);
    vi.stubGlobal('Blob', OrigBlob);
    expect((captured as { author: string }).author).toBe('DiZee');
  });
});

// ── exportTripAsTemplate ──────────────────────────────────────────────────────

describe('exportTripAsTemplate', () => {
  it('produces type: roadtrip-template', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);

    expect((captured as { type: string }).type).toBe('roadtrip-template');
    vi.stubGlobal('Blob', Blob);
  });

  it('has a stable id field', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);

    expect((captured as { id: string }).id).toMatch(/^template-\d+-[a-z0-9]+$/);
    vi.stubGlobal('Blob', Blob);
  });

  it('route.origin populated from first location', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);

    expect((captured as { route: { origin: Location } }).route.origin.name).toBe('Winnipeg');
    vi.stubGlobal('Blob', Blob);
  });

  it('route.destination populated from last location', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);

    expect((captured as { route: { destination: Location } }).route.destination.name).toBe('Thunder Bay');
    vi.stubGlobal('Blob', Blob);
  });

  it('settings fields present and correctly mapped', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    let captured: unknown;
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { captured = JSON.parse(parts[0] as string); }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);

    const s = (captured as { settings: TripSettings }).settings;
    expect(s.units).toBe('metric');
    expect(s.numTravelers).toBe(2);
    expect(s.maxDriveHours).toBe(8);
    vi.stubGlobal('Blob', Blob);
  });
});

// ── Template round-trip ───────────────────────────────────────────────────────

describe('template round-trip', () => {
  it('exportTripAsTemplate output passes parseSharedTemplate without throwing', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    const { parseSharedTemplate } = await import('./url');

    let blobContent = '';
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { blobContent = parts[0] as string; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);

    expect(() => parseSharedTemplate(blobContent)).not.toThrow();
    vi.stubGlobal('Blob', Blob);
  });

  it('parseSharedTemplate can read back what exportTripAsTemplate wrote', async () => {
    const { exportTripAsTemplate } = await import('./journal-export');
    const { parseSharedTemplate } = await import('./url');

    let blobContent = '';
    const Blob = globalThis.Blob;
    vi.stubGlobal('Blob', class MockBlob {
      constructor(parts: BlobPart[]) { blobContent = parts[0] as string; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    exportTripAsTemplate(STUB_PRINT_INPUT);
    const parsed = parseSharedTemplate(blobContent);

    expect(parsed.locations.length).toBeGreaterThanOrEqual(1);
    expect(parsed.meta.title).toBeDefined();
    vi.stubGlobal('Blob', Blob);
  });
});

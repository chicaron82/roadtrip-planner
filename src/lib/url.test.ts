/**
 * url.ts — unit tests for URL serialization, hydration, and template import.
 *
 * serializeStateToURL / parseStateFromURL are integration points for share
 * links and session restore — brittle by nature and previously untested.
 *
 * parseSharedTemplate covers the JSON import flow including validation,
 * sanitization, waypoint deduplication, and lineage building.
 *
 * jsdom provides window.location and window.history in the test environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Location, Vehicle, TripSettings } from '../types';
import type { SharedTemplate } from './url';

// ── Mock template-validator so these tests stay focused on url.ts logic ──────
vi.mock('./template-validator', () => ({
  validateSharedTemplate: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  sanitizeSharedTemplate: vi.fn((t: unknown) => t),
}));

import {
  buildTemplateLineage,
  parseSharedTemplate,
  parseStateFromURL,
  serializeStateToURL,
} from './url';
import { validateSharedTemplate, sanitizeSharedTemplate } from './template-validator';

const mockValidate   = vi.mocked(validateSharedTemplate);
const mockSanitize   = vi.mocked(sanitizeSharedTemplate);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOC_A: Location = { id: 'a', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' };
const LOC_B: Location = { id: 'b', name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' };

const VEHICLE: Vehicle = {
  year: '2022', make: 'Toyota', model: 'Sienna',
  fuelEconomyCity: 10, fuelEconomyHwy: 9, tankSize: 80,
};

const SETTINGS = {
  units: 'metric',
  currency: 'CAD',
  maxDriveHours: 10,
  numTravelers: 2,
  numDrivers: 1,
  budgetMode: 'plan-to-budget',
  budget: { mode: 'plan-to-budget', allocation: 'flexible', profile: 'balanced',
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    gas: 0, hotel: 0, food: 0, misc: 0, total: 1000 },
  departureDate: '2026-08-16',
  departureTime: '09:00',
  returnDate: '', arrivalDate: '', arrivalTime: '',
} as TripSettings;

/** Minimal valid SharedTemplate structure that passes the mocked validator. */
function makeTemplate(overrides: Record<string, unknown> = {}): SharedTemplate {
  return {
    type: 'roadtrip-template',
    version: '1.0',
    id: 'tpl-001',
    author: 'Aaron',
    trip: { title: 'WPG→TB', description: 'Great trip', tags: [], durationDays: 1, totalDistanceKm: 700, totalDurationHours: '8h' },
    route: {
      origin: { id: 'o', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' },
      destination: { id: 'd', name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' },
      waypoints: [],
    },
    ...overrides,
  } as SharedTemplate;
}

// ─── buildTemplateLineage ─────────────────────────────────────────────────────

describe('buildTemplateLineage', () => {
  it('returns empty array when parent has no id and no lineage', () => {
    const lineage = buildTemplateLineage({ title: '', author: '', description: '', recommendations: [] });
    expect(lineage).toEqual([]);
  });

  it('includes parent id at the end when present', () => {
    const lineage = buildTemplateLineage({ title: '', author: '', description: '', recommendations: [], templateId: 'parent-1' });
    expect(lineage).toEqual(['parent-1']);
  });

  it('appends parent id after existing ancestors', () => {
    const lineage = buildTemplateLineage({
      title: '', author: '', description: '', recommendations: [],
      templateId: 'parent-2',
      lineage: ['grandparent-1', 'parent-1'],
    });
    expect(lineage).toEqual(['grandparent-1', 'parent-1', 'parent-2']);
  });

  it('preserves ancestor order (oldest first)', () => {
    const lineage = buildTemplateLineage({
      title: '', author: '', description: '', recommendations: [],
      templateId: 'c',
      lineage: ['a', 'b'],
    });
    expect(lineage[0]).toBe('a');
    expect(lineage[1]).toBe('b');
    expect(lineage[2]).toBe('c');
  });

  it('returns ancestor lineage even when parent has no id', () => {
    const lineage = buildTemplateLineage({
      title: '', author: '', description: '', recommendations: [],
      lineage: ['grandparent'],
    });
    expect(lineage).toEqual(['grandparent']);
  });
});

// ─── parseSharedTemplate ──────────────────────────────────────────────────────

describe('parseSharedTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue({ valid: true, errors: [], warnings: [] });
    mockSanitize.mockImplementation((t: unknown) => t as ReturnType<typeof mockSanitize>);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSharedTemplate('not-json')).toThrow('Invalid JSON');
  });

  it('throws when validation fails', () => {
    mockValidate.mockReturnValue({ valid: false, errors: ['missing route'], warnings: [] });
    expect(() => parseSharedTemplate(JSON.stringify(makeTemplate()))).toThrow('Template validation failed');
  });

  it('returns locations in order: origin → waypoints → destination', () => {
    const tpl = makeTemplate({
      route: {
        origin:      { id: 'o', name: 'Winnipeg',    lat: 49.895, lng: -97.138, type: 'origin' },
        destination: { id: 'd', name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' },
        waypoints:   [{ id: 'w', name: 'Kenora',     lat: 49.766, lng: -94.487, type: 'waypoint' }],
      },
    });
    mockSanitize.mockReturnValue(tpl);

    const { locations } = parseSharedTemplate(JSON.stringify(tpl));

    expect(locations[0].name).toBe('Winnipeg');
    expect(locations[0].type).toBe('origin');
    expect(locations[1].name).toBe('Kenora');
    expect(locations[1].type).toBe('waypoint');
    expect(locations[2].name).toBe('Thunder Bay');
    expect(locations[2].type).toBe('destination');
  });

  it('deduplicates waypoints that share a name with origin or destination', () => {
    const tpl = makeTemplate({
      route: {
        origin:      { id: 'o', name: 'Winnipeg',    lat: 49.895, lng: -97.138, type: 'origin' },
        destination: { id: 'd', name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' },
        // Waypoint that duplicates origin name — should be skipped
        waypoints: [{ id: 'dup', name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'waypoint' }],
      },
    });
    mockSanitize.mockReturnValue(tpl);

    const { locations } = parseSharedTemplate(JSON.stringify(tpl));
    expect(locations).toHaveLength(2); // only origin + destination
  });

  it('populates meta with title, author, description, and templateId', () => {
    const tpl = makeTemplate({ id: 'tpl-42', author: 'DiZee', trip: { title: 'Road Trip', description: 'Fun', tags: [], durationDays: 2, totalDistanceKm: 500, totalDurationHours: '6h' } });
    mockSanitize.mockReturnValue(tpl);

    const { meta } = parseSharedTemplate(JSON.stringify(tpl));

    expect(meta.title).toBe('Road Trip');
    expect(meta.author).toBe('DiZee');
    expect(meta.description).toBe('Fun');
    expect(meta.templateId).toBe('tpl-42');
  });

  it('preserves lineage from the template', () => {
    const tpl = makeTemplate({ lineage: ['ancestor-1', 'ancestor-2'] });
    mockSanitize.mockReturnValue(tpl);

    const { meta } = parseSharedTemplate(JSON.stringify(tpl));
    expect(meta.lineage).toEqual(['ancestor-1', 'ancestor-2']);
  });

  it('assigns generated IDs to locations missing an id', () => {
    const tpl = makeTemplate({
      route: {
        origin:      { name: 'Winnipeg',    lat: 49.895, lng: -97.138, type: 'origin' },      // no id
        destination: { name: 'Thunder Bay', lat: 48.381, lng: -89.247, type: 'destination' }, // no id
        waypoints: [],
      },
    });
    mockSanitize.mockReturnValue(tpl);

    const { locations } = parseSharedTemplate(JSON.stringify(tpl));
    expect(typeof locations[0].id).toBe('string');
    expect(locations[0].id.length).toBeGreaterThan(0);
  });

  it('logs warnings but does not throw when validation has warnings', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockValidate.mockReturnValue({ valid: true, errors: [], warnings: ['missing tags'] });
    const tpl = makeTemplate();
    mockSanitize.mockReturnValue(tpl);

    expect(() => parseSharedTemplate(JSON.stringify(tpl))).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('[TemplateImport]', 'missing tags');
    consoleSpy.mockRestore();
  });
});

// ─── parseStateFromURL ────────────────────────────────────────────────────────

describe('parseStateFromURL', () => {
  function setSearch(params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: qs ? `?${qs}` : '' },
      writable: true,
    });
  }

  beforeEach(() => {
    setSearch({});
  });

  it('returns null when no relevant params are present', () => {
    setSearch({});
    expect(parseStateFromURL()).toBeNull();
  });

  it('parses valid locations from the locs param', () => {
    const locs = [{ name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' }];
    setSearch({ locs: JSON.stringify(locs) });

    const result = parseStateFromURL();
    expect(result?.locations).toHaveLength(1);
    expect(result?.locations?.[0].name).toBe('Winnipeg');
  });

  it('filters out locations with out-of-range coordinates', () => {
    const locs = [
      { name: 'Valid',   lat: 49.895, lng: -97.138, type: 'origin' },
      { name: 'Bad Lat', lat: 99.9,   lng: -97.138, type: 'waypoint' }, // lat > 90
      { name: 'Bad Lng', lat: 49.895, lng: -200,    type: 'waypoint' }, // lng < -180
    ];
    setSearch({ locs: JSON.stringify(locs) });

    const result = parseStateFromURL();
    expect(result?.locations).toHaveLength(1);
    expect(result?.locations?.[0].name).toBe('Valid');
  });

  it('filters out locations with non-numeric coordinates', () => {
    const locs = [{ name: 'Bad', lat: 'not-a-number', lng: -97.138, type: 'origin' }];
    setSearch({ locs: JSON.stringify(locs) });

    const result = parseStateFromURL();
    expect(result?.locations).toHaveLength(0);
  });

  it('parses a valid vehicle from the veh param', () => {
    const veh = { ...VEHICLE };
    setSearch({ veh: JSON.stringify(veh) });

    const result = parseStateFromURL();
    expect(result?.vehicle?.make).toBe('Toyota');
    expect(result?.vehicle?.tankSize).toBe(80);
  });

  it('rejects a vehicle with zero tank size', () => {
    const badVeh = { ...VEHICLE, tankSize: 0 };
    setSearch({ veh: JSON.stringify(badVeh) });

    const result = parseStateFromURL();
    expect(result?.vehicle).toBeUndefined();
  });

  it('parses valid settings from the set param', () => {
    setSearch({ set: JSON.stringify(SETTINGS) });

    const result = parseStateFromURL();
    expect(result?.settings?.maxDriveHours).toBe(10);
    expect(result?.settings?.units).toBe('metric');
  });

  it('rejects settings with a negative maxDriveHours', () => {
    const badSettings = { ...SETTINGS, maxDriveHours: -1 };
    setSearch({ set: JSON.stringify(badSettings) });

    const result = parseStateFromURL();
    expect(result?.settings).toBeUndefined();
  });

  it('returns null (not throw) when locs is malformed JSON', () => {
    setSearch({ locs: 'not-json', veh: JSON.stringify(VEHICLE) });
    expect(() => parseStateFromURL()).not.toThrow();
  });

  it('assigns missing IDs to hydrated locations', () => {
    const locs = [{ name: 'Winnipeg', lat: 49.895, lng: -97.138, type: 'origin' }]; // no id
    setSearch({ locs: JSON.stringify(locs) });

    const result = parseStateFromURL();
    expect(typeof result?.locations?.[0].id).toBe('string');
    expect(result?.locations?.[0].id?.length).toBeGreaterThan(0);
  });
});

// ─── serializeStateToURL ──────────────────────────────────────────────────────

describe('serializeStateToURL', () => {
  let replaceStateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    replaceStateSpy = vi.fn();
    Object.defineProperty(window, 'history', {
      value: { ...window.history, replaceState: replaceStateSpy },
      writable: true,
    });
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', search: '' },
      writable: true,
    });
  });

  it('calls history.replaceState once', () => {
    serializeStateToURL([LOC_A, LOC_B], VEHICLE, SETTINGS);
    expect(replaceStateSpy).toHaveBeenCalledOnce();
  });

  it('includes locs, veh, and set params in the URL', () => {
    serializeStateToURL([LOC_A, LOC_B], VEHICLE, SETTINGS);
    const url: string = replaceStateSpy.mock.calls[0][2];
    expect(url).toContain('locs=');
    expect(url).toContain('veh=');
    expect(url).toContain('set=');
  });

  it('strips origin name/coords when includeStartingLocation is false', () => {
    const privacySettings = { ...SETTINGS, includeStartingLocation: false };
    serializeStateToURL([LOC_A, LOC_B], VEHICLE, privacySettings);
    const url: string = replaceStateSpy.mock.calls[0][2];
    const params = new URLSearchParams(url.split('?')[1]);
    const locs = JSON.parse(params.get('locs')!);
    expect(locs[0].name).toBe('');
    expect(locs[0].lat).toBe(0);
    expect(locs[0].lng).toBe(0);
  });

  it('preserves all other locations when origin is stripped', () => {
    const privacySettings = { ...SETTINGS, includeStartingLocation: false };
    serializeStateToURL([LOC_A, LOC_B], VEHICLE, privacySettings);
    const url: string = replaceStateSpy.mock.calls[0][2];
    const params = new URLSearchParams(url.split('?')[1]);
    const locs = JSON.parse(params.get('locs')!);
    expect(locs[1].name).toBe('Thunder Bay');
  });
});

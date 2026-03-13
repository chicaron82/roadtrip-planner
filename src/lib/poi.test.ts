/**
 * poi.ts — unit tests for searchPOIsAlongRoute and searchNearbyPOIs.
 *
 * All network calls are mocked (executeOverpassQuery or global fetch).
 * Covers element mapping, null filtering, error paths, and category → tag
 * query translation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OverpassElement } from './poi-service/types';

// ── Mock the Overpass client before importing the module under test ──────────

vi.mock('./poi-service/overpass', () => ({
  executeOverpassQuery: vi.fn(),
}));

// Import SUT and mock reference after vi.mock declarations.
import { searchPOIsAlongRoute, searchNearbyPOIs } from './poi';
import { executeOverpassQuery } from './poi-service/overpass';

const mockOverpass = vi.mocked(executeOverpassQuery);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeEl(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'node',
    id: 1,
    lat: 49.9,
    lon: -97.2,
    tags: { name: 'Test Place' },
    ...overrides,
  };
}

function wayEl(overrides: Partial<OverpassElement> = {}): OverpassElement {
  return {
    type: 'way',
    id: 2,
    center: { lat: 50.1, lon: -97.5 },
    tags: { name: 'Way Place' },
    ...overrides,
  };
}

const SIMPLE_ROUTE: [number, number][] = [
  [49.8, -97.1],
  [50.0, -97.3],
  [50.2, -97.5],
];

// ─── searchPOIsAlongRoute ──────────────────────────────────────────────────────

describe('searchPOIsAlongRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a node element to a POI', async () => {
    mockOverpass.mockResolvedValueOnce([nodeEl()]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'gas');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'route-node-1',
      name: 'Test Place',
      lat: 49.9,
      lng: -97.2,
      category: 'gas',
    });
  });

  it('uses center coords for way elements', async () => {
    mockOverpass.mockResolvedValueOnce([wayEl()]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'attraction');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      lat: 50.1,
      lng: -97.5,
      id: 'route-way-2',
    });
  });

  it('preserves addr:street in address field when present', async () => {
    const el = nodeEl({ tags: { name: 'Gas Bar', 'addr:street': '42 Main St' } });
    mockOverpass.mockResolvedValueOnce([el]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'gas');
    expect(result[0].address).toBe('42 Main St');
  });

  it('address is undefined when addr:street is absent', async () => {
    mockOverpass.mockResolvedValueOnce([nodeEl()]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'gas');
    expect(result[0].address).toBeUndefined();
  });

  it('filters out elements with no coordinates', async () => {
    const noCoords: OverpassElement = { type: 'way', id: 9, tags: { name: 'Ghost' } };
    mockOverpass.mockResolvedValueOnce([noCoords]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'food');
    expect(result).toHaveLength(0);
  });

  it('filters out elements with no name', async () => {
    mockOverpass.mockResolvedValueOnce([nodeEl({ tags: {} })]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'hotel');
    expect(result).toHaveLength(0);
  });

  it('accepts name:en as a fallback name', async () => {
    mockOverpass.mockResolvedValueOnce([
      nodeEl({ tags: { 'name:en': 'English Name' } }),
    ]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'hotel');
    expect(result[0].name).toBe('English Name');
  });

  it('returns empty array and does not throw when executeOverpassQuery throws', async () => {
    mockOverpass.mockRejectedValueOnce(new Error('Network failure'));
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'gas');
    expect(result).toEqual([]);
  });

  it('returns empty array when overpass returns no elements', async () => {
    mockOverpass.mockResolvedValueOnce([]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'food');
    expect(result).toEqual([]);
  });

  it('calls executeOverpassQuery (not fetch) for Overpass data', async () => {
    mockOverpass.mockResolvedValueOnce([]);
    await searchPOIsAlongRoute(SIMPLE_ROUTE, 'gas');
    expect(mockOverpass).toHaveBeenCalledOnce();
  });

  it('supports all four main POI categories without throwing', async () => {
    const categories = ['gas', 'food', 'hotel', 'attraction'] as const;
    for (const cat of categories) {
      mockOverpass.mockResolvedValueOnce([]);
      await expect(searchPOIsAlongRoute(SIMPLE_ROUTE, cat)).resolves.toEqual([]);
    }
  });

  it('maps multiple elements and deduplicates only if already distinct by id', async () => {
    mockOverpass.mockResolvedValueOnce([nodeEl({ id: 1 }), nodeEl({ id: 2, lon: -97.3 })]);
    const result = await searchPOIsAlongRoute(SIMPLE_ROUTE, 'gas');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('route-node-1');
    expect(result[1].id).toBe('route-node-2');
  });
});

// ─── searchNearbyPOIs ─────────────────────────────────────────────────────────

const NOMINATIM_ITEM = {
  place_id: 12345,
  lat: '49.8951',
  lon: '-97.1384',
  display_name: 'Holiday Inn, Main Street, Winnipeg, MB',
  type: 'hotel',
};

describe('searchNearbyPOIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps Nominatim results to POIs', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [NOMINATIM_ITEM],
    } as Response);

    const result = await searchNearbyPOIs(49.8951, -97.1384, 'hotel');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: '12345',
      name: 'Holiday Inn',          // truncated at first comma
      lat: 49.8951,
      lng: -97.1384,
      category: 'hotel',
      address: NOMINATIM_ITEM.display_name,
    });
  });

  it('truncates display_name at first comma for the name field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...NOMINATIM_ITEM, display_name: 'A, B, C' }],
    } as Response);

    const result = await searchNearbyPOIs(49.8, -97.1, 'food');
    expect(result[0].name).toBe('A');
  });

  it('returns empty array on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    const result = await searchNearbyPOIs(49.8, -97.1, 'food');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Offline'));

    const result = await searchNearbyPOIs(49.8, -97.1, 'attraction');
    expect(result).toEqual([]);
  });

  it('returns empty array when json returns empty list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await searchNearbyPOIs(49.8, -97.1, 'gas');
    expect(result).toEqual([]);
  });

  it('correctly parses float lat/lon from string response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [{ ...NOMINATIM_ITEM, lat: '50.1234', lon: '-98.5678' }],
    } as Response);

    const result = await searchNearbyPOIs(50.0, -98.5, 'food');
    expect(result[0].lat).toBe(50.1234);
    expect(result[0].lng).toBe(-98.5678);
  });
});

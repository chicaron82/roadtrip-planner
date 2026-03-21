/**
 * usePOI — hook integration tests
 *
 * Covers toggleCategory state transitions (loading, error, POI append/remove),
 * clearError, resetPOIs, and the route-vs-point fallback logic.
 *
 * usePOISuggestions is mocked entirely — its own tests live in
 * usePOISuggestionHelpers.test.ts.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { POI } from '../../types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../lib/poi', () => ({
  searchNearbyPOIs: vi.fn(),
  searchPOIsAlongRoute: vi.fn(),
}));

vi.mock('./usePOISuggestions', () => ({
  usePOISuggestions: vi.fn(),
}));

import { usePOI } from './usePOI';
import { searchNearbyPOIs, searchPOIsAlongRoute } from '../../lib/poi';
import { usePOISuggestions } from './usePOISuggestions';

const mockSearchNearby = vi.mocked(searchNearbyPOIs);
const mockSearchAlongRoute = vi.mocked(searchPOIsAlongRoute);
const mockUsePOISuggestions = vi.mocked(usePOISuggestions);

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const ROUTE: [number, number][] = [
  [49.8, -97.1],
  [50.0, -97.3],
];

const SEARCH_LOCATION = { id: 'loc-wpg', name: 'Winnipeg', lat: 49.8, lng: -97.1, type: 'waypoint' as const };
const NO_LOCATION    = { id: 'none', name: '', lat: 0, lng: 0, type: 'waypoint' as const };

function makePOI(id: string, category: POI['category'] = 'gas'): POI {
  return { id, name: `Place ${id}`, lat: 49.9, lng: -97.2, category };
}

const stubSuggestions = {
  poiSuggestions: [],
  poiInference: [],
  isLoadingPOIs: false,
  poiPartialResults: false,
  poiFetchFailed: false,
  addPOI: vi.fn(),
  dismissPOI: vi.fn(),
  resetPOISuggestions: vi.fn(),
};

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePOISuggestions.mockReturnValue(stubSuggestions);
  mockSearchAlongRoute.mockResolvedValue([]);
  mockSearchNearby.mockResolvedValue([]);
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('starts with no POIs loaded', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.pois).toEqual([]);
  });

  it('starts with all marker categories hidden', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.markerCategories.every(c => !c.visible)).toBe(true);
  });

  it('starts with no loading category', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.loadingCategory).toBeNull();
  });

  it('starts with no error', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.error).toBeNull();
  });

  it('exposes the four default categories gas/food/hotel/attraction', () => {
    const { result } = renderHook(() => usePOI({}));
    const ids = result.current.markerCategories.map(c => c.id);
    expect(ids).toEqual(['gas', 'food', 'hotel', 'attraction']);
  });
});

// ─── toggleCategory — route corridor path ─────────────────────────────────────

describe('toggleCategory with routeGeometry', () => {
  it('calls searchPOIsAlongRoute (not searchNearbyPOIs) when route is present', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([makePOI('g1')]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', SEARCH_LOCATION, ROUTE);
    });

    expect(mockSearchAlongRoute).toHaveBeenCalledOnce();
    expect(mockSearchNearby).not.toHaveBeenCalled();
  });

  it('appends returned POIs to pois state', async () => {
    const pois = [makePOI('g1'), makePOI('g2')];
    mockSearchAlongRoute.mockResolvedValueOnce(pois);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    expect(result.current.pois).toHaveLength(2);
    expect(result.current.pois[0].id).toBe('g1');
  });

  it('marks the category as visible after toggling on', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([makePOI('g1')]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    const gasCategory = result.current.markerCategories.find(c => c.id === 'gas');
    expect(gasCategory?.visible).toBe(true);
  });

  it('does not duplicate POIs that already exist by id', async () => {
    mockSearchAlongRoute
      .mockResolvedValueOnce([makePOI('g1')])
      .mockResolvedValueOnce([makePOI('g1'), makePOI('g2')]); // g1 already present

    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    // Simulate a second category flush by toggling food too
    await act(async () => {
      await result.current.toggleCategory('food', null, ROUTE);
    });

    const ids = result.current.pois.map(p => p.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });
});

// ─── toggleCategory — point search fallback ───────────────────────────────────

describe('toggleCategory point-search fallback', () => {
  it('calls searchNearbyPOIs when no route geometry is provided', async () => {
    mockSearchNearby.mockResolvedValueOnce([makePOI('h1', 'hotel')]);
    const { result } = renderHook(() => usePOI({}));

    await act(async () => {
      await result.current.toggleCategory('hotel', SEARCH_LOCATION, null);
    });

    expect(mockSearchNearby).toHaveBeenCalledOnce();
    expect(mockSearchAlongRoute).not.toHaveBeenCalled();
  });

  it('appends point-search POIs to pois state', async () => {
    mockSearchNearby.mockResolvedValueOnce([makePOI('h1', 'hotel')]);
    const { result } = renderHook(() => usePOI({}));

    await act(async () => {
      await result.current.toggleCategory('hotel', SEARCH_LOCATION, null);
    });

    expect(result.current.pois).toHaveLength(1);
    expect(result.current.pois[0].category).toBe('hotel');
  });
});

// ─── toggleCategory — error paths ─────────────────────────────────────────────

describe('toggleCategory error handling', () => {
  it('sets error and reverts category when no route and no valid location', async () => {
    const { result } = renderHook(() => usePOI({}));

    await act(async () => {
      await result.current.toggleCategory('gas', NO_LOCATION, null);
    });

    expect(result.current.error).toBe('Please calculate a route first.');
    const gasCategory = result.current.markerCategories.find(c => c.id === 'gas');
    expect(gasCategory?.visible).toBe(false);
  });

  it('sets "No X found" error when search returns empty array', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    expect(result.current.error).toMatch(/no gas found/i);
  });

  it('sets "Failed to fetch places." and reverts category on throw', async () => {
    mockSearchAlongRoute.mockRejectedValueOnce(new Error('Boom'));
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    expect(result.current.error).toBe('Failed to fetch places.');
    const gasCategory = result.current.markerCategories.find(c => c.id === 'gas');
    expect(gasCategory?.visible).toBe(false);
  });

  it('clears error at the start of each toggle call', async () => {
    mockSearchAlongRoute
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce([makePOI('g1')]);

    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    // second toggle: gas was off (reverted), so now turning on
    // and the second mock resolves — error should clear
    expect(result.current.error).toBeNull();
  });
});

// ─── toggleCategory — loading state ──────────────────────────────────────────

describe('toggleCategory loading state', () => {
  it('sets loadingCategory to the toggled id while fetching', async () => {
    let resolveSearch!: (v: POI[]) => void;
    mockSearchAlongRoute.mockReturnValueOnce(
      new Promise<POI[]>(res => { resolveSearch = res; }),
    );

    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    act(() => {
      result.current.toggleCategory('food', null, ROUTE);
    });

    await waitFor(() => {
      expect(result.current.loadingCategory).toBe('food');
    });

    await act(async () => {
      resolveSearch([makePOI('f1', 'food')]);
    });

    await waitFor(() => {
      expect(result.current.loadingCategory).toBeNull();
    });
  });
});

// ─── toggleCategory — hide path ───────────────────────────────────────────────

describe('toggleCategory hide path', () => {
  it('removes POIs of the toggled category when turning off', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([makePOI('g1'), makePOI('g2')]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    // Turn on
    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    expect(result.current.pois).toHaveLength(2);

    // Turn off
    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    expect(result.current.pois).toHaveLength(0);
  });

  it('only removes POIs matching the toggled category, not others', async () => {
    mockSearchAlongRoute
      .mockResolvedValueOnce([makePOI('g1', 'gas')])
      .mockResolvedValueOnce([makePOI('f1', 'food')]);

    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    await act(async () => {
      await result.current.toggleCategory('food', null, ROUTE);
    });
    // Toggle gas off
    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    expect(result.current.pois).toHaveLength(1);
    expect(result.current.pois[0].category).toBe('food');
  });

  it('marks the category as hidden when turning off', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([makePOI('g1')]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    const gasCategory = result.current.markerCategories.find(c => c.id === 'gas');
    expect(gasCategory?.visible).toBe(false);
  });
});

// ─── clearError ───────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('clears the error state', async () => {
    const { result } = renderHook(() => usePOI({}));

    // Trigger an error
    await act(async () => {
      await result.current.toggleCategory('gas', NO_LOCATION, null);
    });
    expect(result.current.error).toBeTruthy();

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });
});

// ─── resetPOIs ────────────────────────────────────────────────────────────────

describe('resetPOIs', () => {
  it('clears all pois', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([makePOI('g1')]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });
    expect(result.current.pois).toHaveLength(1);

    act(() => { result.current.resetPOIs(); });
    expect(result.current.pois).toHaveLength(0);
  });

  it('resets all category visibility to false', async () => {
    mockSearchAlongRoute.mockResolvedValueOnce([makePOI('g1')]);
    const { result } = renderHook(() => usePOI({ routeGeometry: ROUTE }));

    await act(async () => {
      await result.current.toggleCategory('gas', null, ROUTE);
    });

    act(() => { result.current.resetPOIs(); });

    expect(result.current.markerCategories.every(c => !c.visible)).toBe(true);
  });

  it('calls resetPOISuggestions from the suggestions sub-hook', () => {
    const resetPOISuggestions = vi.fn();
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, resetPOISuggestions });

    const { result } = renderHook(() => usePOI({}));
    act(() => { result.current.resetPOIs(); });

    expect(resetPOISuggestions).toHaveBeenCalledOnce();
  });
});

// ─── delegated state from usePOISuggestions ───────────────────────────────────

describe('delegated suggestion state', () => {
  it('surfaces isLoadingPOIs from usePOISuggestions', () => {
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, isLoadingPOIs: true });
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.isLoadingPOIs).toBe(true);
  });

  it('surfaces poiFetchFailed from usePOISuggestions', () => {
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, poiFetchFailed: true });
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.poiFetchFailed).toBe(true);
  });

  it('surfaces addPOI function from usePOISuggestions', () => {
    const addPOI = vi.fn();
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, addPOI });
    const { result } = renderHook(() => usePOI({}));
    act(() => { result.current.addPOI('test-id'); });
    expect(addPOI).toHaveBeenCalledWith('test-id');
  });

  it('surfaces dismissPOI function from usePOISuggestions', () => {
    const dismissPOI = vi.fn();
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, dismissPOI });
    const { result } = renderHook(() => usePOI({}));
    act(() => { result.current.dismissPOI('bad-id'); });
    expect(dismissPOI).toHaveBeenCalledWith('bad-id');
  });
});

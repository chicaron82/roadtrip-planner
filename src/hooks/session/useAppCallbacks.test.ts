/**
 * useAppCallbacks — unit tests for derived callback logic.
 *
 * Focus: handleToggleCategory location-picking and null-guard logic.
 * These edge cases were invisible before — a zero-coord or missing
 * destination location silently passed null downstream, causing the
 * POI filter to fire with no valid search anchor.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Location, POICategory } from '../../types';
import { useAppCallbacks } from './useAppCallbacks';

type ToggleFn = (id: POICategory, loc: Location | null, geom?: [number, number][] | null) => void;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ROUTE: [number, number][] = [[49.8, -97.1], [48.3, -89.2]];

function makeLocation(overrides: Partial<Location> = {}): Location {
  return { id: 'loc-1', name: 'Winnipeg', lat: 49.8, lng: -97.1, type: 'waypoint', ...overrides };
}

const DESTINATION = makeLocation({ id: 'dest', type: 'destination', lat: 49.8, lng: -97.1 });
const WAYPOINT    = makeLocation({ id: 'wp',   type: 'waypoint',    lat: 50.0, lng: -97.3 });
const ZERO_COORD  = makeLocation({ id: 'zero', lat: 0, lng: 0 });

// ─── Default params ───────────────────────────────────────────────────────────

function makeParams(overrides: Partial<Parameters<typeof useAppCallbacks>[0]> = {}) {
  return {
    poiError: null,
    calcError: null,
    journalError: null,
    clearPOIError: vi.fn(),
    clearCalcError: vi.fn(),
    clearJournalError: vi.fn(),
    triggerCopyShareLink: vi.fn(),
    shareUrl: null,
    locations: [DESTINATION],
    toggleCategory: vi.fn() as unknown as ToggleFn,
    validRouteGeometry: ROUTE,
    planningStep: 3 as const,
    calculateAndDiscover: vi.fn(),
    wizardNext: vi.fn(),
    setTripMode: vi.fn(),
    ...overrides,
  };
}

// ─── handleToggleCategory — location picking ──────────────────────────────────

describe('handleToggleCategory location picking', () => {
  // mockToggle is the raw vi.fn() for .mock.calls assertions.
  // toggleFn is the same reference cast to satisfy the hook's param type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockToggle: ReturnType<typeof vi.fn>;
  let toggleFn: ToggleFn;

  beforeEach(() => {
    mockToggle = vi.fn();
    toggleFn = mockToggle as unknown as ToggleFn;
  });

  it('passes the destination location when one exists with non-zero coords', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [WAYPOINT, DESTINATION], toggleCategory: toggleFn })));

    act(() => { result.current.handleToggleCategory('food' as POICategory); });

    const [, loc] = mockToggle.mock.calls[0];
    expect(loc).toMatchObject({ type: 'destination', id: 'dest' });
  });

  it('falls back to locations[0] when no destination is present', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [WAYPOINT], toggleCategory: toggleFn })));

    act(() => { result.current.handleToggleCategory('gas' as POICategory); });

    const [, loc] = mockToggle.mock.calls[0];
    expect(loc).toMatchObject({ id: 'wp' });
  });

  it('passes null when the only location has zero coords', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [ZERO_COORD], toggleCategory: toggleFn })));

    act(() => { result.current.handleToggleCategory('hotel' as POICategory); });

    const [, loc] = mockToggle.mock.calls[0];
    expect(loc).toBeNull();
  });

  it('skips a destination with zero coords and falls back to locations[0]', () => {
    const zeroDest = makeLocation({ id: 'zdest', type: 'destination', lat: 0, lng: 0 });
    // zeroDest is type=destination but lat=0 — should be skipped by the find
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [WAYPOINT, zeroDest], toggleCategory: toggleFn })));

    act(() => { result.current.handleToggleCategory('food' as POICategory); });

    const [, loc] = mockToggle.mock.calls[0];
    // zeroDest has lat=0 so the find() skips it; fallback is WAYPOINT
    // Then loc.lat !== 0 so WAYPOINT is passed through
    expect(loc).toMatchObject({ id: 'wp' });
  });

  it('always forwards the validRouteGeometry as the third argument', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [DESTINATION], toggleCategory: toggleFn, validRouteGeometry: ROUTE })));

    act(() => { result.current.handleToggleCategory('attraction' as POICategory); });

    const [, , geom] = mockToggle.mock.calls[0];
    expect(geom).toBe(ROUTE);
  });

  it('passes null geometry when validRouteGeometry is null', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [DESTINATION], toggleCategory: toggleFn, validRouteGeometry: null })));

    act(() => { result.current.handleToggleCategory('gas' as POICategory); });

    const [, , geom] = mockToggle.mock.calls[0];
    expect(geom).toBeNull();
  });

  it('forwards the correct category id as the first argument', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ locations: [DESTINATION], toggleCategory: toggleFn })));

    act(() => { result.current.handleToggleCategory('hotel' as POICategory); });

    const [categoryId] = mockToggle.mock.calls[0];
    expect(categoryId).toBe('hotel');
  });
});

// ─── error aggregation ────────────────────────────────────────────────────────

describe('error aggregation', () => {
  it('surfaces poiError when present', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ poiError: 'POI failed' })));
    expect(result.current.error).toBe('POI failed');
  });

  it('surfaces calcError when poiError is null', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ calcError: 'Calc failed' })));
    expect(result.current.error).toBe('Calc failed');
  });

  it('is null when all errors are null', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams()));
    expect(result.current.error).toBeNull();
  });

  it('clearError calls all three clear functions', () => {
    const clearPOIError    = vi.fn();
    const clearCalcError   = vi.fn();
    const clearJournalError = vi.fn();
    const { result } = renderHook(() => useAppCallbacks(makeParams({ clearPOIError, clearCalcError, clearJournalError })));

    act(() => { result.current.clearError(); });

    expect(clearPOIError).toHaveBeenCalledOnce();
    expect(clearCalcError).toHaveBeenCalledOnce();
    expect(clearJournalError).toHaveBeenCalledOnce();
  });
});

// ─── goToNextStep ─────────────────────────────────────────────────────────────

describe('goToNextStep', () => {
  it('calls calculateAndDiscover on step 2', () => {
    const calculateAndDiscover = vi.fn();
    const { result } = renderHook(() => useAppCallbacks(makeParams({ planningStep: 2, calculateAndDiscover })));

    act(() => { result.current.goToNextStep(); });

    expect(calculateAndDiscover).toHaveBeenCalledOnce();
  });

  it('calls wizardNext on step 1', () => {
    const wizardNext = vi.fn();
    const { result } = renderHook(() => useAppCallbacks(makeParams({ planningStep: 1, wizardNext })));

    act(() => { result.current.goToNextStep(); });

    expect(wizardNext).toHaveBeenCalledOnce();
  });
});

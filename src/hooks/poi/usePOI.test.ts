/**
 * usePOI — hook integration tests
 *
 * Discovery Panel and map-category toggle were removed (Apr 3, 2026).
 * usePOI now surfaces poiSuggestions/poiInference from usePOISuggestions
 * and exposes clearError + resetPOIs.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./usePOISuggestions', () => ({
  usePOISuggestions: vi.fn(),
}));

import type { POISuggestion } from '../../types';
import { usePOI } from './usePOI';
import { usePOISuggestions } from './usePOISuggestions';

const mockUsePOISuggestions = vi.mocked(usePOISuggestions);

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_SUGGESTIONS = [{ id: 's1' }] as unknown as POISuggestion[];
const MOCK_INFERENCE   = [{ id: 'i1' }] as unknown as POISuggestion[];

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
});

// ─── poiSuggestions ───────────────────────────────────────────────────────────

describe('poiSuggestions', () => {
  it('surfaces poiSuggestions from usePOISuggestions', () => {
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, poiSuggestions: MOCK_SUGGESTIONS });
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.poiSuggestions).toBe(MOCK_SUGGESTIONS);
  });

  it('returns empty array when no suggestions', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.poiSuggestions).toEqual([]);
  });
});

// ─── poiInference ─────────────────────────────────────────────────────────────

describe('poiInference', () => {
  it('surfaces poiInference from usePOISuggestions', () => {
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, poiInference: MOCK_INFERENCE });
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.poiInference).toBe(MOCK_INFERENCE);
  });

  it('returns empty array when no inference data', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(result.current.poiInference).toEqual([]);
  });
});

// ─── resetPOIs ────────────────────────────────────────────────────────────────

describe('resetPOIs', () => {
  it('calls resetPOISuggestions from the suggestions sub-hook', () => {
    const resetPOISuggestions = vi.fn();
    mockUsePOISuggestions.mockReturnValue({ ...stubSuggestions, resetPOISuggestions });

    const { result } = renderHook(() => usePOI({}));
    act(() => { result.current.resetPOIs(); });

    expect(resetPOISuggestions).toHaveBeenCalledOnce();
  });
});

// ─── clearError ───────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('is a no-op function (no error state in simplified hook)', () => {
    const { result } = renderHook(() => usePOI({}));
    expect(() => act(() => { result.current.clearError(); })).not.toThrow();
  });
});

// ─── options forwarding ───────────────────────────────────────────────────────

describe('options forwarding to usePOISuggestions', () => {
  it('passes routeGeometry to usePOISuggestions', () => {
    const route: [number, number][] = [[49.8, -97.1], [50.0, -97.3]];
    renderHook(() => usePOI({ routeGeometry: route }));
    expect(mockUsePOISuggestions).toHaveBeenCalledWith(expect.objectContaining({ routeGeometry: route }));
  });

  it('passes origin and destination to usePOISuggestions', () => {
    const origin    = { id: 'o', name: 'A', lat: 49.8, lng: -97.1, type: 'origin' as const };
    const destination = { id: 'd', name: 'B', lat: 50.0, lng: -97.3, type: 'destination' as const };
    renderHook(() => usePOI({ origin, destination }));
    expect(mockUsePOISuggestions).toHaveBeenCalledWith(expect.objectContaining({ origin, destination }));
  });
});

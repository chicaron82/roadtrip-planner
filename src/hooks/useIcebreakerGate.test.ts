/**
 * useIcebreakerGate — Tests
 *
 * Covers the batching trap (setTripMode vs selectTripMode distinction),
 * landing flow routing, and estimate workshop transitions.
 *
 * CRITICAL: On completion, setTripMode must be used — NOT selectTripMode.
 * selectTripMode calls resetTripSession which wipes locations (prefill destroyed).
 * selectTripMode is only correct for the escape path.
 *
 * 💚 My Experience Engine
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIcebreakerGate } from './useIcebreakerGate';
import type { IcebreakerPrefill } from '../components/Icebreaker/IcebreakerGate';
import type { Location, TripSettings } from '../types';

// ── Mock storage ──────────────────────────────────────────────────────────────

vi.mock('../lib/storage', () => ({
  getEntryPreference: vi.fn(),
  saveEntryPreference: vi.fn(),
}));

import { getEntryPreference, saveEntryPreference } from '../lib/storage';
const mockGetPref = vi.mocked(getEntryPreference);
const mockSavePref = vi.mocked(saveEntryPreference);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORIGIN: Location = { id: 'wpg', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' };
const DEST: Location   = { id: 'tb',  name: 'Thunder Bay', lat: 48.38, lng: -89.25, type: 'destination' };

const MOCK_PREFILL: IcebreakerPrefill = {
  locations: [ORIGIN, DEST],
  settingsPartial: { numTravelers: 2 },
};

function makeOpts(overrides: Partial<Parameters<typeof useIcebreakerGate>[0]> = {}) {
  return {
    selectTripMode: vi.fn(),
    setTripMode: vi.fn(),
    setShowAdventureMode: vi.fn(),
    setLocations: vi.fn(),
    setVehicle: vi.fn(),
    setSettings: vi.fn(),
    markStepComplete: vi.fn(),
    forceStep: vi.fn(),
    onFourBeatArc: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPref.mockReturnValue(null); // default: first-timer
});

// ── Batching trap — the critical regression ───────────────────────────────────

describe('batching trap regression', () => {
  it('handleIcebreakerComplete uses setTripMode (not selectTripMode) — prefill survives', () => {
    // Test the non-arc path: onFourBeatArc absent → setTripMode('plan') is called.
    // When onFourBeatArc IS present, the arc handler fires instead (no direct setTripMode call here).
    const opts = makeOpts({ onFourBeatArc: undefined });
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('plan', MOCK_PREFILL); });

    expect(opts.setTripMode).toHaveBeenCalledWith('plan');
    expect(opts.selectTripMode).not.toHaveBeenCalled();
  });

  it('handleIcebreakerComplete applies location prefill before opening wizard', () => {
    const opts = makeOpts({ onFourBeatArc: undefined });
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('plan', MOCK_PREFILL); });

    expect(opts.setLocations).toHaveBeenCalledWith(MOCK_PREFILL.locations);
  });

  it('handleIcebreakerComplete applies settings prefill', () => {
    const opts = makeOpts({ onFourBeatArc: undefined });
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('plan', MOCK_PREFILL); });

    expect(opts.setSettings).toHaveBeenCalled();
  });

  it('handleIcebreakerEscape uses selectTripMode — clean slate correct', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerEscape('plan'); });

    expect(opts.selectTripMode).toHaveBeenCalledWith('plan');
    expect(opts.setTripMode).not.toHaveBeenCalled();
  });

  it('handleIcebreakerEscape does NOT apply location prefill', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerEscape('plan'); });

    expect(opts.setLocations).not.toHaveBeenCalled();
  });
});

// ── handleLandingSelect ───────────────────────────────────────────────────────

describe('handleLandingSelect()', () => {
  it('routes to selectTripMode when preference is "classic"', () => {
    mockGetPref.mockReturnValue('classic');
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleLandingSelect('plan'); });

    expect(opts.selectTripMode).toHaveBeenCalledWith('plan');
    expect(result.current.icebreakerMode).toBeNull();
  });

  it('sets icebreakerMode for first-timer (null preference)', () => {
    mockGetPref.mockReturnValue(null);
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleLandingSelect('plan'); });

    expect(result.current.icebreakerMode).toBe('plan');
    expect(opts.selectTripMode).not.toHaveBeenCalled();
  });

  it('sets icebreakerMode for "conversational" preference', () => {
    mockGetPref.mockReturnValue('conversational');
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleLandingSelect('plan'); });

    expect(result.current.icebreakerMode).toBe('plan');
  });
});

// ── Four-Beat Arc routing ─────────────────────────────────────────────────────

describe('Four-Beat Arc routing', () => {
  it('calls onFourBeatArc when provided and mode is plan', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('plan', MOCK_PREFILL); });

    expect(opts.onFourBeatArc).toHaveBeenCalledWith(MOCK_PREFILL);
  });

  it('clears icebreakerMode when Four-Beat Arc fires', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleLandingSelect('plan'); });
    act(() => { result.current.handleIcebreakerComplete('plan', MOCK_PREFILL); });

    expect(result.current.icebreakerMode).toBeNull();
  });
});

// ── Estimate Workshop ─────────────────────────────────────────────────────────

describe('estimate workshop', () => {
  it('sets estimateWorkshopActive on estimate mode completion', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('estimate', MOCK_PREFILL); });

    expect(result.current.estimateWorkshopActive).toBe(true);
  });

  it('clears estimateWorkshopActive and opens wizard on commit', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('estimate', MOCK_PREFILL); });
    act(() => { result.current.handleEstimateWorkshopCommit({ numTravelers: 2 } as Partial<TripSettings>); });

    expect(result.current.estimateWorkshopActive).toBe(false);
    expect(opts.setTripMode).toHaveBeenCalledWith('plan');
  });

  it('clears estimateWorkshopActive on escape', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('estimate', MOCK_PREFILL); });
    act(() => { result.current.handleEstimateWorkshopEscape(); });

    expect(result.current.estimateWorkshopActive).toBe(false);
    expect(opts.setTripMode).toHaveBeenCalledWith('plan');
  });
});

// ── Adventure flow ────────────────────────────────────────────────────────────

describe('adventure flow', () => {
  it('adventureInitialValues populated on adventure completion with prefill', () => {
    const adventurePrefill = { origin: ORIGIN, budget: 2000 };
    const prefillWithAdventure: IcebreakerPrefill = {
      ...MOCK_PREFILL,
      adventurePrefill: adventurePrefill as never,
    };
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('adventure', prefillWithAdventure); });

    expect(result.current.adventureInitialValues).toEqual(adventurePrefill);
    expect(opts.setShowAdventureMode).toHaveBeenCalledWith(true);
  });

  it('uses setTripMode (not selectTripMode) for adventure mode activation', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerComplete('adventure', MOCK_PREFILL); });

    expect(opts.setTripMode).toHaveBeenCalledWith('adventure');
    expect(opts.selectTripMode).not.toHaveBeenCalled();
  });

  it('escape from estimate routes to plan (not estimate mode)', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerEscape('estimate'); });

    expect(opts.selectTripMode).toHaveBeenCalledWith('plan');
  });
});

// ── saveAsClassic ─────────────────────────────────────────────────────────────

describe('saveAsClassic', () => {
  it('saves classic preference when escape is called with saveAsClassic=true', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerEscape('plan', true); });

    expect(mockSavePref).toHaveBeenCalledWith('classic');
  });

  it('does NOT save preference on normal escape', () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useIcebreakerGate(opts));

    act(() => { result.current.handleIcebreakerEscape('plan'); });

    expect(mockSavePref).not.toHaveBeenCalled();
  });
});

/**
 * reset-semantics.ts — unit tests
 *
 * Pure orchestration: a reset calls every clearer, in order, and wipes the persisted session.
 * Storage is exercised for real (jsdom localStorage), not mocked — the point of a reset is that the
 * saved session is actually GONE, and a mocked clearer can only prove it was called.
 *
 * ⭐ Pins the April regression (deecefd, 2026-04-03): the custom trip title survived "start fresh"
 * and the next trip inherited the previous trip's name. The fix was one line; this is its guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { resetTripSession, resetAppAndSelectTripMode } from './reset-semantics';
import { DEFAULT_LOCATIONS } from '../contexts';
import {
  saveSessionPhase, loadSessionPhase, loadActiveSession, saveActiveSession,
} from './storage';
import type { Location, TripSettings } from '../types';

function makeParams() {
  const calls: string[] = [];
  const track = (name: string) => vi.fn(() => { calls.push(name); });
  return {
    calls,
    params: {
      setLocations: vi.fn(() => { calls.push('setLocations'); }),
      clearTripCalculation: track('clearTripCalculation'),
      resetPOIs: track('resetPOIs'),
      clearStops: track('clearStops'),
      resetWizard: track('resetWizard'),
      setActiveChallenge: vi.fn(() => { calls.push('setActiveChallenge'); }),
      setTripOrigin: vi.fn(() => { calls.push('setTripOrigin'); }),
      setTripConfirmed: vi.fn(() => { calls.push('setTripConfirmed'); }),
      clearJournal: track('clearJournal'),
      setCustomTitle: vi.fn(() => { calls.push('setCustomTitle'); }),
    },
  };
}

const REAL_TRIP: Location[] = [
  { id: 'a', name: 'Winnipeg', lat: 49.9, lng: -97.1, type: 'origin' },
  { id: 'b', name: 'Gimli', lat: 50.6, lng: -96.99, type: 'destination' },
] as Location[];

/**
 * ⚠️ src/test/setup.ts replaces localStorage with no-op vi.fn()s — getItem always returns undefined.
 * Against that, "the saved session is gone after a reset" passes whether or not the reset clears
 * anything. Found by the control assertion below failing on the first run. So these tests give the
 * mock a real memory, through its own functions (the property itself is not redefinable).
 */
function useMemoryStorage() {
  const store = new Map<string, string>();
  const ls = localStorage as unknown as Record<'getItem' | 'setItem' | 'removeItem' | 'clear', Mock>;
  ls.getItem.mockImplementation((k: string) => store.get(k) ?? null);
  ls.setItem.mockImplementation((k: string, v: string) => { store.set(k, String(v)); });
  ls.removeItem.mockImplementation((k: string) => { store.delete(k); });
  ls.clear.mockImplementation(() => store.clear());
}

describe('resetTripSession', () => {
  beforeEach(() => { useMemoryStorage(); localStorage.clear(); });
  afterEach(() => {
    const ls = localStorage as unknown as Record<string, Mock>;
    for (const k of ['getItem', 'setItem', 'removeItem', 'clear']) ls[k].mockReset();
  });

  it('clears the custom trip title — the April carry-over regression', () => {
    const { params } = makeParams();
    resetTripSession(params);
    expect(params.setCustomTitle).toHaveBeenCalledWith(null);
  });

  it('puts the planning inputs back to the default locations', () => {
    const { params } = makeParams();
    resetTripSession(params);
    expect(params.setLocations).toHaveBeenCalledWith(DEFAULT_LOCATIONS);
  });

  it('clears every piece of trip state, and unconfirms the trip', () => {
    const { params } = makeParams();
    resetTripSession(params);
    expect(params.clearTripCalculation).toHaveBeenCalledOnce();
    expect(params.resetPOIs).toHaveBeenCalledOnce();
    expect(params.clearStops).toHaveBeenCalledOnce();
    expect(params.resetWizard).toHaveBeenCalledOnce();
    expect(params.clearJournal).toHaveBeenCalledOnce();
    expect(params.setActiveChallenge).toHaveBeenCalledWith(null);
    expect(params.setTripOrigin).toHaveBeenCalledWith(null);
    expect(params.setTripConfirmed).toHaveBeenCalledWith(false);
  });

  it('runs the clearers in a fixed order: inputs first, title last', () => {
    const { params, calls } = makeParams();
    resetTripSession(params);
    expect(calls).toEqual([
      'setLocations', 'clearTripCalculation', 'resetPOIs', 'clearStops', 'resetWizard',
      'setActiveChallenge', 'setTripOrigin', 'setTripConfirmed', 'clearJournal', 'setCustomTitle',
    ]);
  });

  it('wipes the persisted session so a reload cannot resurrect the old trip', () => {
    saveActiveSession(REAL_TRIP, {} as TripSettings);
    saveSessionPhase('voila');
    expect(loadActiveSession()).not.toBeNull();   // control: it really was saved
    expect(loadSessionPhase()).toBe('voila');

    resetTripSession(makeParams().params);

    expect(loadActiveSession()).toBeNull();
    expect(loadSessionPhase()).toBeNull();
  });

  it('tolerates the two optional clearers being absent', () => {
    const { params } = makeParams();
    const { clearJournal: _j, setCustomTitle: _t, ...required } = params;
    expect(() => resetTripSession(required)).not.toThrow();
  });
});

describe('resetAppAndSelectTripMode', () => {
  function modeParams(mode: 'plan' | 'adventure') {
    const calls: string[] = [];
    const fn = (name: string) => vi.fn(() => { calls.push(name); });
    return {
      calls,
      params: {
        mode,
        resetTripSession: fn('resetTripSession'),
        clearSharedUrlState: fn('clearSharedUrlState'),
        setTripMode: vi.fn(() => { calls.push('setTripMode'); }),
        setShowAdventureMode: vi.fn(() => { calls.push('setShowAdventureMode'); }),
        applyLastOrigin: fn('applyLastOrigin'),
      },
    };
  }

  it('resets before anything else, and applies the last origin last', () => {
    const { params, calls } = modeParams('plan');
    resetAppAndSelectTripMode(params);
    // ⚠️ Order is the contract: applying the last origin BEFORE the reset would be wiped by it.
    expect(calls).toEqual([
      'resetTripSession', 'clearSharedUrlState', 'setTripMode', 'setShowAdventureMode', 'applyLastOrigin',
    ]);
  });

  it('shows adventure mode only when adventure was chosen', () => {
    const plan = modeParams('plan');
    resetAppAndSelectTripMode(plan.params);
    expect(plan.params.setTripMode).toHaveBeenCalledWith('plan');
    expect(plan.params.setShowAdventureMode).toHaveBeenCalledWith(false);

    const adv = modeParams('adventure');
    resetAppAndSelectTripMode(adv.params);
    expect(adv.params.setTripMode).toHaveBeenCalledWith('adventure');
    expect(adv.params.setShowAdventureMode).toHaveBeenCalledWith(true);
  });
});

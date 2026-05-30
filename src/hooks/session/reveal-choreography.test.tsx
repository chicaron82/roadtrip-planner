/**
 * Reveal-choreography integration test
 *
 * Composes the REAL useVoilaFlow + useJournalAutoStart the way App.tsx wires
 * them — shared tripConfirmed state, voila-flow's showVoila + dismissVoilaCurtain
 * feeding journal-auto-start, and startJournal flipping activeJournal (as useJournal
 * does) to guard re-entry. This crosses the hook boundary the unit tests can't:
 * the flyover → lock-in → journal-behind-the-curtain handoff.
 *
 * Why not a full <App/> render: App pulls in a lazy Leaflet Map, TripProvider,
 * OSRM/Overpass network and localStorage session — none of which the choreography
 * depends on. The reveal logic lives entirely in these two hooks, so composing
 * them is the honest seam.
 *
 * 💚 My Experience Engine
 */

import { renderHook, act } from '@testing-library/react';
import { useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Location, TripSettings, TripSummary } from '../../types';

vi.mock('../../lib/storage', () => ({
  loadActiveSession: vi.fn(() => null),
  loadSessionPhase: vi.fn(() => 'default'),
  saveSessionPhase: vi.fn(),
}));
vi.mock('../../lib/trip-title-seeds', () => ({
  buildSeededTitle: vi.fn(() => 'SEEDED_TITLE'),
}));

import { useVoilaFlow } from './useVoilaFlow';
import { useJournalAutoStart } from './useJournalAutoStart';

const SUMMARY = { drivingDays: 2 } as TripSummary;
const LOCATIONS: Location[] = [
  { id: 'wpg', name: 'Winnipeg, MB', lat: 49.9, lng: -97.1, type: 'origin' },
  { id: 'yyc', name: 'Calgary, AB', lat: 51.0, lng: -114.1, type: 'destination' },
];
const SETTINGS = { numTravelers: 2 } as TripSettings;

/** Composes the two reveal hooks like App.tsx, sharing tripConfirmed + activeJournal. */
function useRevealHarness(opts: { journalSkipped?: boolean; startJournalSpy: (t?: string) => void }) {
  const [tripConfirmed, setTripConfirmed] = useState(false);
  const [activeJournal, setActiveJournal] = useState<{ id: string } | null>(null);

  // Mirrors useJournal.startJournal: records the call, then sets activeJournal
  // so the auto-start guard won't re-fire.
  const startJournal = useCallback(async (title?: string) => {
    opts.startJournalSpy(title);
    setActiveJournal({ id: 'j1' });
  }, [opts]);

  const voila = useVoilaFlow({
    icebreakerOrigin: false,
    isCalculating: false,
    setTripMode: vi.fn(),
    setViewMode: vi.fn(),
    goToStep: vi.fn(),
    forceStep: vi.fn(),
    setTripConfirmed,
  });

  useJournalAutoStart({
    tripConfirmed,
    summary: SUMMARY,
    showVoila: voila.showVoila,
    activeJournal,
    isJournalComplete: false,
    journalSkipped: opts.journalSkipped ?? false,
    isJournalLoading: false,
    startJournal,
    dismissVoilaCurtain: voila.dismissVoilaCurtain,
    customTitle: null,
    locations: LOCATIONS,
    settings: SETTINGS,
  });

  return { voila, tripConfirmed, activeJournal };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('full reveal choreography', () => {
  it('flyover → lock-in → journal starts once behind the curtain, then curtain drops', async () => {
    const startJournalSpy = vi.fn();
    const { result } = renderHook(() => useRevealHarness({ startJournalSpy }));

    // 1. Flyover plays, then completes → curtain up, trip not yet confirmed.
    act(() => result.current.voila.triggerFlyover());
    act(() => result.current.voila.handleFlyoverComplete());
    expect(result.current.voila.showVoila).toBe(true);
    expect(startJournalSpy).not.toHaveBeenCalled(); // not confirmed yet

    // 2. Lock in → tripConfirmed flips, curtain stays up as the journal creates.
    act(() => result.current.voila.handleVoilaLockIn());
    expect(result.current.tripConfirmed).toBe(true);
    expect(result.current.voila.showVoila).toBe(true); // curtain still up

    // 3. Behind the curtain (0ms delay), the journal is created exactly once...
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(startJournalSpy).toHaveBeenCalledTimes(1);
    expect(startJournalSpy).toHaveBeenCalledWith('SEEDED_TITLE');

    // 4. ...and the curtain then drops.
    expect(result.current.voila.showVoila).toBe(false);

    // 5. No double-fire after the curtain drops and effects settle.
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(startJournalSpy).toHaveBeenCalledTimes(1);
  });

  it('skip branch: lock-in with journalSkipped drops the curtain without starting a journal', async () => {
    const startJournalSpy = vi.fn();
    const { result } = renderHook(() =>
      useRevealHarness({ startJournalSpy, journalSkipped: true }),
    );

    act(() => result.current.voila.handleFlyoverComplete());
    act(() => result.current.voila.handleVoilaLockIn());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(startJournalSpy).not.toHaveBeenCalled();
    expect(result.current.voila.showVoila).toBe(false); // curtain still dismissed
  });
});

/**
 * useJournalAutoStart — guard matrix + timing tests
 *
 * This effect is the 7-guard gate that creates the trip journal after
 * lock-in, behind the voilà curtain. Order and timing matter: it must
 * fire exactly once, choose the right title, honor the 0ms-behind-curtain
 * vs 700ms-banner-morph delay, and dismiss the curtain when done.
 *
 * 💚 My Experience Engine
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Location, TripSettings, TripSummary } from '../../types';

vi.mock('../../lib/trip-title-seeds', () => ({
  buildSeededTitle: vi.fn(() => 'SEEDED_TITLE'),
}));

import { useJournalAutoStart } from './useJournalAutoStart';
import { buildSeededTitle } from '../../lib/trip-title-seeds';

const mockBuildSeededTitle = vi.mocked(buildSeededTitle);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SUMMARY = { drivingDays: 3 } as TripSummary;
const LOCATIONS: Location[] = [
  { id: 'wpg', name: 'Winnipeg, MB', lat: 49.9, lng: -97.1, type: 'origin' },
  { id: 'yyc', name: 'Calgary, AB', lat: 51.0, lng: -114.1, type: 'destination' },
];
const SETTINGS = { numTravelers: 2 } as TripSettings;

function baseOptions(overrides: Partial<Parameters<typeof useJournalAutoStart>[0]> = {}) {
  return {
    tripConfirmed: true,
    summary: SUMMARY,
    showVoila: true,
    activeJournal: null,
    isJournalComplete: false,
    journalSkipped: false,
    isJournalLoading: false,
    startJournal: vi.fn(() => Promise.resolve()),
    dismissVoilaCurtain: vi.fn(),
    customTitle: null,
    locations: LOCATIONS,
    settings: SETTINGS,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// ── Happy path ────────────────────────────────────────────────────────────────
describe('happy path', () => {
  it('starts the journal once (behind the curtain) then dismisses it', async () => {
    const opts = baseOptions({ showVoila: true });
    renderHook(() => useJournalAutoStart(opts));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(opts.startJournal).toHaveBeenCalledTimes(1);
    expect(opts.startJournal).toHaveBeenCalledWith('SEEDED_TITLE');
    expect(opts.dismissVoilaCurtain).toHaveBeenCalledTimes(1);
  });

  it('seeds the title from destination, driving days, and traveler count', async () => {
    const opts = baseOptions();
    renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mockBuildSeededTitle).toHaveBeenCalledWith({
      destination: 'Calgary',
      days: 3,
      travelerCount: 2,
    });
  });

  it('prefers a customTitle over the seeded title', async () => {
    const opts = baseOptions({ customTitle: 'Rocky Mountain Run' });
    renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(opts.startJournal).toHaveBeenCalledWith('Rocky Mountain Run');
    expect(mockBuildSeededTitle).not.toHaveBeenCalled();
  });

  it('passes undefined title when there is no destination', async () => {
    const opts = baseOptions({ locations: [LOCATIONS[0]] }); // origin only
    renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(opts.startJournal).toHaveBeenCalledWith(undefined);
  });
});

// ── Timing ────────────────────────────────────────────────────────────────────
describe('delay', () => {
  it('fires at 0ms when the voilà curtain is up', async () => {
    const opts = baseOptions({ showVoila: true });
    renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(opts.startJournal).toHaveBeenCalledTimes(1);
  });

  it('waits 700ms (banner morph) when the curtain is down', async () => {
    const opts = baseOptions({ showVoila: false });
    renderHook(() => useJournalAutoStart(opts));

    await act(async () => { await vi.advanceTimersByTimeAsync(699); });
    expect(opts.startJournal).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(opts.startJournal).toHaveBeenCalledTimes(1);
  });
});

// ── Guards ────────────────────────────────────────────────────────────────────
describe('guards block the journal start', () => {
  it.each([
    ['trip not confirmed', { tripConfirmed: false }],
    ['no summary', { summary: null }],
    ['journal already complete', { isJournalComplete: true }],
    ['journal already active', { activeJournal: { id: 'x' } }],
    ['journal creation in flight', { isJournalLoading: true }],
  ])('%s → startJournal is not called', async (_label, override) => {
    const opts = baseOptions(override as Partial<ReturnType<typeof baseOptions>>);
    renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(opts.startJournal).not.toHaveBeenCalled();
  });

  it('journalSkipped → dismisses the curtain but does not start a journal', async () => {
    const opts = baseOptions({ journalSkipped: true });
    renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(opts.startJournal).not.toHaveBeenCalled();
    expect(opts.dismissVoilaCurtain).toHaveBeenCalledTimes(1);
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
describe('cleanup', () => {
  it('does not start the journal if unmounted before the timer fires', async () => {
    const opts = baseOptions({ showVoila: false }); // 700ms delay
    const { unmount } = renderHook(() => useJournalAutoStart(opts));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(opts.startJournal).not.toHaveBeenCalled();
  });
});

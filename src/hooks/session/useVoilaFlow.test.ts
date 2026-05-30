/**
 * useVoilaFlow — reveal-flow state machine tests
 *
 * Covers the post-calculation curtain choreography: flyover → voilà →
 * lock-in (curtain stays up) → dismiss. The lock-in/curtain handoff
 * (lockInPendingRef) is the fragile, order-dependent part the broader
 * suite can't reach.
 *
 * 💚 My Experience Engine
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../../lib/storage', () => ({
  loadActiveSession: vi.fn(() => null),
  loadSessionPhase: vi.fn(() => 'default'),
  saveSessionPhase: vi.fn(),
}));

import { useVoilaFlow } from './useVoilaFlow';
import { loadActiveSession, loadSessionPhase, saveSessionPhase } from '../../lib/storage';

const mockLoadActiveSession = vi.mocked(loadActiveSession);
const mockLoadSessionPhase = vi.mocked(loadSessionPhase);
const mockSaveSessionPhase = vi.mocked(saveSessionPhase);

// ── Harness ───────────────────────────────────────────────────────────────────
function setup(overrides: Partial<Parameters<typeof useVoilaFlow>[0]> = {}) {
  const spies = {
    setTripMode: vi.fn(),
    setViewMode: vi.fn(),
    goToStep: vi.fn(),
    forceStep: vi.fn(),
    setTripConfirmed: vi.fn(),
  };
  const view = renderHook(() =>
    useVoilaFlow({
      icebreakerOrigin: false,
      isCalculating: false,
      ...spies,
      ...overrides,
    }),
  );
  return { ...view, spies };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadActiveSession.mockReturnValue(null);
  mockLoadSessionPhase.mockReturnValue('default');
});

// ── Init ────────────────────────────────────────────────────────────────────
describe('initial state', () => {
  it('starts with flyover off and voila hidden by default', () => {
    const { result } = setup();
    expect(result.current.flyoverActive).toBe(false);
    expect(result.current.showVoila).toBe(false);
  });

  it('seeds showVoila=true when session phase is voila and a session exists', () => {
    mockLoadSessionPhase.mockReturnValue('voila');
    mockLoadActiveSession.mockReturnValue({} as ReturnType<typeof loadActiveSession>);
    const { result } = setup();
    expect(result.current.showVoila).toBe(true);
  });

  it('does NOT seed showVoila when phase is voila but no session exists', () => {
    mockLoadSessionPhase.mockReturnValue('voila');
    mockLoadActiveSession.mockReturnValue(null);
    const { result } = setup();
    expect(result.current.showVoila).toBe(false);
  });

  it('persists the phase when showVoila changes', () => {
    const { result } = setup();
    act(() => result.current.handleShowVoila());
    expect(mockSaveSessionPhase).toHaveBeenCalledWith('voila');
  });
});

// ── Flyover → voilà ───────────────────────────────────────────────────────────
describe('flyover → voilà', () => {
  it('triggerFlyover turns the flyover on', () => {
    const { result } = setup();
    act(() => result.current.triggerFlyover());
    expect(result.current.flyoverActive).toBe(true);
  });

  it('handleFlyoverComplete turns flyover off and raises the voilà curtain', () => {
    const { result } = setup();
    act(() => result.current.triggerFlyover());
    act(() => result.current.handleFlyoverComplete());
    expect(result.current.flyoverActive).toBe(false);
    expect(result.current.showVoila).toBe(true);
  });
});

// ── Lock-in / curtain handoff ───────────────────────────────────────────────
describe('lock-in and the voilà curtain', () => {
  it('confirms the trip and forces step 3 but keeps the curtain up', () => {
    const { result, spies } = setup();
    act(() => result.current.handleFlyoverComplete()); // raise curtain first
    act(() => result.current.handleVoilaLockIn());

    expect(spies.setTripConfirmed).toHaveBeenCalledWith(true);
    expect(spies.forceStep).toHaveBeenCalledWith(3);
    // Curtain must stay up while the journal creates behind it.
    expect(result.current.showVoila).toBe(true);
  });

  it('dismissVoilaCurtain drops the curtain only after a pending lock-in', () => {
    const { result } = setup();
    act(() => result.current.handleFlyoverComplete());

    // No lock-in pending yet → dismiss is a no-op.
    act(() => result.current.dismissVoilaCurtain());
    expect(result.current.showVoila).toBe(true);

    // After lock-in, dismiss drops the curtain.
    act(() => result.current.handleVoilaLockIn());
    act(() => result.current.dismissVoilaCurtain());
    expect(result.current.showVoila).toBe(false);
  });

  it('sets tripMode to plan on lock-in only when icebreaker-originated', () => {
    const classic = setup({ icebreakerOrigin: false });
    act(() => classic.result.current.handleVoilaLockIn());
    expect(classic.spies.setTripMode).not.toHaveBeenCalled();

    const arc = setup({ icebreakerOrigin: true });
    act(() => arc.result.current.handleVoilaLockIn());
    expect(arc.spies.setTripMode).toHaveBeenCalledWith('plan');
  });
});

// ── Navigation transitions ────────────────────────────────────────────────────
describe('navigation transitions', () => {
  it('handleVoilaEdit drops voila, unconfirms, resets to plan view, goes to step 2', () => {
    const { result, spies } = setup();
    act(() => result.current.handleFlyoverComplete());
    act(() => result.current.handleVoilaEdit());

    expect(result.current.showVoila).toBe(false);
    expect(spies.setTripConfirmed).toHaveBeenCalledWith(false);
    expect(spies.setViewMode).toHaveBeenCalledWith('plan');
    expect(spies.goToStep).toHaveBeenCalledWith(2);
  });

  it('handleViewFullDetails drops voila and forces step 3', () => {
    const { result, spies } = setup();
    act(() => result.current.handleFlyoverComplete());
    act(() => result.current.handleViewFullDetails());
    expect(result.current.showVoila).toBe(false);
    expect(spies.forceStep).toHaveBeenCalledWith(3);
  });

  it('handleGoHome is a no-op while calculating', () => {
    const { result, spies } = setup({ isCalculating: true });
    act(() => result.current.handleFlyoverComplete());
    act(() => result.current.handleGoHome());
    expect(result.current.showVoila).toBe(true);
    expect(spies.setTripMode).not.toHaveBeenCalled();
  });

  it('handleGoHome clears mode and voila when idle', () => {
    const { result, spies } = setup({ isCalculating: false });
    act(() => result.current.handleFlyoverComplete());
    act(() => result.current.handleGoHome());
    expect(result.current.showVoila).toBe(false);
    expect(spies.setTripMode).toHaveBeenCalledWith(null);
  });

  it('handleReturnToJournal restores journal view and hides voila', () => {
    const { result, spies } = setup();
    act(() => result.current.handleMinimizeToVoila());
    expect(result.current.showVoila).toBe(true);
    act(() => result.current.handleReturnToJournal());
    expect(spies.setViewMode).toHaveBeenCalledWith('journal');
    expect(result.current.showVoila).toBe(false);
  });
});

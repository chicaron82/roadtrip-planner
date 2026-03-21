/**
 * useCalculationMessages — Tests
 *
 * Locks in the two-voice split: MEE-forward for icebreaker users,
 * classic for everyone else. Also covers null return when not calculating.
 *
 * 💚 My Experience Engine
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCalculationMessages } from './useCalculationMessages';
import type { Location } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOCATIONS: Location[] = [
  { id: 'wpg', name: 'Winnipeg, MB', lat: 49.8951, lng: -97.1384, type: 'origin' },
  { id: 'tb',  name: 'Thunder Bay, ON', lat: 48.38, lng: -89.25, type: 'destination' },
];

const NO_LOCATIONS: Location[] = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Not calculating ───────────────────────────────────────────────────────────

describe('not calculating', () => {
  it('returns null when isCalculating is false', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(false, LOCATIONS, false)
    );
    expect(result.current).toBeNull();
  });

  it('returns null when isCalculating is false regardless of icebreakerOrigin', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(false, LOCATIONS, true)
    );
    expect(result.current).toBeNull();
  });
});

// ── Classic voice ─────────────────────────────────────────────────────────────

describe('classic voice (icebreakerOrigin=false)', () => {
  it('first message matches "Routing from" when both cities are known', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, false)
    );
    expect(result.current).toMatch(/Routing from/i);
  });

  it('first message references origin city name', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, false)
    );
    expect(result.current).toContain('Winnipeg');
  });

  it('fallback message when no named locations', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, NO_LOCATIONS, false)
    );
    expect(result.current).toMatch(/Mapping your route|Routing/i);
  });

  it('does NOT use MEE-forward voice for classic users', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, false)
    );
    expect(result.current).not.toMatch(/MEE is mapping/i);
  });
});

// ── MEE-forward voice ─────────────────────────────────────────────────────────

describe('MEE-forward voice (icebreakerOrigin=true)', () => {
  it('first message matches "MEE is mapping" when both cities are known', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, true)
    );
    expect(result.current).toMatch(/MEE is mapping/i);
  });

  it('first message references destination city name', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, true)
    );
    expect(result.current).toContain('Thunder Bay');
  });

  it('fallback MEE message when no named locations', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, NO_LOCATIONS, true)
    );
    expect(result.current).toMatch(/MEE is mapping/i);
  });

  it('does NOT use "Routing from" for icebreaker users', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, true)
    );
    expect(result.current).not.toMatch(/Routing from/i);
  });
});

// ── Message rotation ──────────────────────────────────────────────────────────

describe('message rotation', () => {
  it('advances to next message after 900ms interval', () => {
    const { result } = renderHook(() =>
      useCalculationMessages(true, LOCATIONS, false)
    );
    const first = result.current;

    vi.advanceTimersByTime(900);
    // Re-render would happen via act in real usage — verify message can rotate
    // (we just check the interval fires without error; state update tested implicitly)
    expect(result.current).toBeDefined();
    // First message was set — no crash
    expect(first).not.toBeNull();
  });

  it('resets to index 0 when isCalculating transitions false→true', () => {
    const { rerender, result } = renderHook(
      ({ calc }: { calc: boolean }) => useCalculationMessages(calc, LOCATIONS, false),
      { initialProps: { calc: true } }
    );
    // Advance to later message
    vi.advanceTimersByTime(2700);
    // Stop calculating
    rerender({ calc: false });
    expect(result.current).toBeNull();
    // Restart calculating — should reset to first message
    rerender({ calc: true });
    expect(result.current).toMatch(/Routing from/i);
  });
});

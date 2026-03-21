/**
 * useRevealAnimation — unit tests
 *
 * Pure timing logic — no DOM, no component rendering needed.
 * Uses fake timers to verify the stagger sequence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRevealAnimation } from './useRevealAnimation';

describe('useRevealAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts with all layers hidden when hasTrip is false on mount', () => {
    const { result } = renderHook(() => useRevealAnimation(false));
    expect(result.current).toEqual({ layer1: false, layer2: false, layer3: false });
  });

  it('starts with all layers visible when hasTrip is true on mount (saved trip load)', () => {
    const { result } = renderHook(() => useRevealAnimation(true));
    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });
  });

  // ── Reveal sequence ────────────────────────────────────────────────────────

  it('shows layer1 immediately when hasTrip transitions false → true', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    act(() => { rerender({ hasTrip: true }); });

    expect(result.current.layer1).toBe(true);
    expect(result.current.layer2).toBe(false);
    expect(result.current.layer3).toBe(false);
  });

  it('shows layer2 at 150ms after reveal starts', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    act(() => { rerender({ hasTrip: true }); });
    act(() => { vi.advanceTimersByTime(149); });

    expect(result.current.layer2).toBe(false);

    act(() => { vi.advanceTimersByTime(1); }); // exactly 150ms

    expect(result.current.layer2).toBe(true);
    expect(result.current.layer3).toBe(false);
  });

  it('shows layer3 at 280ms after reveal starts', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    act(() => { rerender({ hasTrip: true }); });
    act(() => { vi.advanceTimersByTime(279); });

    expect(result.current.layer3).toBe(false);

    act(() => { vi.advanceTimersByTime(1); }); // exactly 280ms

    expect(result.current.layer3).toBe(true);
  });

  it('all layers visible after full sequence completes', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    act(() => { rerender({ hasTrip: true }); });
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });
  });

  // ── Reset behaviour ────────────────────────────────────────────────────────

  it('resets all layers immediately when hasTrip goes false', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: true },
    });

    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });

    act(() => { rerender({ hasTrip: false }); });

    expect(result.current).toEqual({ layer1: false, layer2: false, layer3: false });
  });

  it('cancels in-flight timers when hasTrip goes false mid-sequence', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    act(() => { rerender({ hasTrip: true }); });
    act(() => { vi.advanceTimersByTime(100); }); // layer1 visible, layer2 not yet

    expect(result.current.layer1).toBe(true);
    expect(result.current.layer2).toBe(false);

    act(() => { rerender({ hasTrip: false }); }); // trip cleared mid-sequence

    expect(result.current).toEqual({ layer1: false, layer2: false, layer3: false });

    // Advancing past the original 150ms / 280ms — should NOT change anything
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current).toEqual({ layer1: false, layer2: false, layer3: false });
  });

  // ── Re-reveal after reset ──────────────────────────────────────────────────

  it('first build uses full stagger; recalculation reveals all layers instantly', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    // First reveal — full luxury stagger
    act(() => { rerender({ hasTrip: true }); });
    expect(result.current.layer1).toBe(true);
    expect(result.current.layer2).toBe(false);   // staggered
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });

    // Trip cleared (recalculating)
    act(() => { rerender({ hasTrip: false }); });
    expect(result.current).toEqual({ layer1: false, layer2: false, layer3: false });

    // Second reveal (recalculation) — instant, all layers together
    act(() => { rerender({ hasTrip: true }); });
    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });
  });

  // ── No double-reveal ───────────────────────────────────────────────────────

  it('does not re-trigger sequence if hasTrip stays true across re-renders', () => {
    const { result, rerender } = renderHook(({ hasTrip }) => useRevealAnimation(hasTrip), {
      initialProps: { hasTrip: false },
    });

    act(() => { rerender({ hasTrip: true }); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });

    // Re-render with same value — no reset, no re-sequence
    act(() => { rerender({ hasTrip: true }); });
    expect(result.current).toEqual({ layer1: true, layer2: true, layer3: true });
  });
});

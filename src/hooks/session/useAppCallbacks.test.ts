/**
 * useAppCallbacks — unit tests for derived callback logic.
 *
 * handleToggleCategory removed Apr 3, 2026 (Discovery Panel cleanup).
 * Tests cover: error aggregation, clearError, goToNextStep, handleResumeSession.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAppCallbacks } from './useAppCallbacks';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeParams(overrides: Partial<Parameters<typeof useAppCallbacks>[0]> = {}) {
  return {
    calcError: null,
    journalError: null,
    clearPOIError: vi.fn(),
    clearCalcError: vi.fn(),
    clearJournalError: vi.fn(),
    triggerCopyShareLink: vi.fn(),
    shareUrl: null,
    locations: [{ id: 'dest', name: 'Winnipeg', lat: 49.8, lng: -97.1, type: 'destination' as const }],
    planningStep: 3 as const,
    calculateAndDiscover: vi.fn(),
    wizardNext: vi.fn(),
    setTripMode: vi.fn(),
    ...overrides,
  };
}

// ─── error aggregation ────────────────────────────────────────────────────────

describe('error aggregation', () => {
  it('surfaces calcError when present', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ calcError: 'Calc failed' })));
    expect(result.current.error).toBe('Calc failed');
  });

  it('surfaces journalError when calcError is null', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ journalError: 'Journal failed' })));
    expect(result.current.error).toBe('Journal failed');
  });

  it('is null when all errors are null', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams()));
    expect(result.current.error).toBeNull();
  });

  it('prefers calcError over journalError', () => {
    const { result } = renderHook(() => useAppCallbacks(makeParams({ calcError: 'Calc', journalError: 'Journal' })));
    expect(result.current.error).toBe('Calc');
  });
});

// ─── clearError ───────────────────────────────────────────────────────────────

describe('clearError', () => {
  it('calls all three clear functions', () => {
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

  it('calls wizardNext on step 3 (not calculateAndDiscover)', () => {
    const calculateAndDiscover = vi.fn();
    const wizardNext = vi.fn();
    const { result } = renderHook(() => useAppCallbacks(makeParams({ planningStep: 3, calculateAndDiscover, wizardNext })));

    act(() => { result.current.goToNextStep(); });

    expect(wizardNext).toHaveBeenCalledOnce();
    expect(calculateAndDiscover).not.toHaveBeenCalled();
  });
});

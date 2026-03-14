/**
 * trip-formatters.ts — unit tests for pure display formatting utilities.
 *
 * No mocks needed — all functions are stateless transformations.
 */

import { describe, it, expect } from 'vitest';
import { formatDistance, formatCurrencySimple, formatDuration, getDayNumber } from './trip-formatters';

// ─── formatDistance ───────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('formats km in metric', () => {
    expect(formatDistance(700, 'metric')).toBe('700.0 km');
  });

  it('converts to miles in imperial', () => {
    const result = formatDistance(100, 'imperial');
    expect(result).toMatch(/mi$/);
    expect(result).toMatch(/62/); // 100km ≈ 62.1mi
  });

  it('respects precision parameter', () => {
    expect(formatDistance(700, 'metric', 0)).toBe('700 km');
  });

  it('uses 1 decimal place by default', () => {
    expect(formatDistance(700.5, 'metric')).toBe('700.5 km');
  });

  it('handles zero distance', () => {
    expect(formatDistance(0, 'metric')).toBe('0.0 km');
  });
});

// ─── formatCurrencySimple ──────────────────────────────────────────────────────

describe('formatCurrencySimple', () => {
  it('prefixes with $ and shows 2 decimal places', () => {
    expect(formatCurrencySimple(150)).toBe('$150.00');
  });

  it('handles cents correctly', () => {
    expect(formatCurrencySimple(12.5)).toBe('$12.50');
  });

  it('handles zero', () => {
    expect(formatCurrencySimple(0)).toBe('$0.00');
  });

  it('handles large amounts', () => {
    expect(formatCurrencySimple(1234.99)).toBe('$1234.99');
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('shows only minutes when under 1h', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('shows only hours when evenly divisible', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('shows hours and minutes for mixed duration', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('handles 0 minutes', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('rounds minutes correctly', () => {
    // 61.4 min → 1h 1m
    expect(formatDuration(61.4)).toBe('1h 1m');
  });

  it('shows only hours when rounding eliminates minutes', () => {
    // 60.4 → floor(60.4/60)=1h, round(60.4%60)=0m → "1h"
    expect(formatDuration(60.4)).toBe('1h');
  });
});

// ─── getDayNumber ─────────────────────────────────────────────────────────────

describe('getDayNumber', () => {
  it('returns 1 when departure date equals current date', () => {
    expect(getDayNumber('2026-08-16', '2026-08-16')).toBe(1);
  });

  it('returns 2 on the next day', () => {
    expect(getDayNumber('2026-08-16', '2026-08-17')).toBe(2);
  });

  it('returns 3 two days after departure', () => {
    expect(getDayNumber('2026-08-16', '2026-08-18')).toBe(3);
  });

  it('is 1-indexed (not 0-indexed)', () => {
    expect(getDayNumber('2026-08-16', '2026-08-16')).toBeGreaterThanOrEqual(1);
  });
});

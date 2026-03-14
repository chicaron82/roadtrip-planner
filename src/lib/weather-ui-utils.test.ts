/**
 * weather-ui-utils.ts — unit tests
 *
 * Pure functions — no mocks needed.
 * Covers: getWeatherGradientClass, getWeatherHexColor, getWeatherEmoji.
 */

import { describe, it, expect } from 'vitest';
import { getWeatherGradientClass, getWeatherHexColor, getWeatherEmoji } from './weather-ui-utils';

// ─── getWeatherGradientClass ──────────────────────────────────────────────────

describe('getWeatherGradientClass', () => {
  it('returns fallback for undefined code', () => {
    expect(getWeatherGradientClass(undefined)).toContain('muted-foreground');
  });

  it('returns sky gradient for clear sky (code 0)', () => {
    expect(getWeatherGradientClass(0)).toContain('sky-300');
  });

  it('returns sky gradient for mostly clear (code 1)', () => {
    expect(getWeatherGradientClass(1)).toContain('sky-300');
  });

  it('returns partly cloudy gradient for code 2', () => {
    expect(getWeatherGradientClass(2)).toContain('sky-200');
  });

  it('returns overcast gradient for code 3', () => {
    expect(getWeatherGradientClass(3)).toContain('sky-200');
  });

  it('returns fog gradient for code 45', () => {
    expect(getWeatherGradientClass(45)).toContain('slate-200');
  });

  it('returns fog gradient for code 48 (rime fog)', () => {
    expect(getWeatherGradientClass(48)).toContain('slate-200');
  });

  it('returns drizzle gradient for code 51', () => {
    expect(getWeatherGradientClass(51)).toContain('slate-400');
  });

  it('returns drizzle gradient for code 61 (light rain)', () => {
    expect(getWeatherGradientClass(61)).toContain('slate-400');
  });

  it('returns heavy rain gradient for code 65', () => {
    expect(getWeatherGradientClass(65)).toContain('slate-500');
  });

  it('returns heavy rain gradient for code 82 (violent showers)', () => {
    expect(getWeatherGradientClass(82)).toContain('blue-700');
  });

  it('returns snow gradient for code 71', () => {
    expect(getWeatherGradientClass(71)).toContain('white');
  });

  it('returns snow gradient for code 85 (snow showers)', () => {
    expect(getWeatherGradientClass(85)).toContain('white');
  });

  it('returns thunderstorm gradient for code 95', () => {
    expect(getWeatherGradientClass(95)).toContain('indigo-900');
  });

  it('returns thunderstorm gradient for code 99', () => {
    expect(getWeatherGradientClass(99)).toContain('indigo-900');
  });

  it('returns fallback for unlisted code (e.g. 10)', () => {
    expect(getWeatherGradientClass(10)).toContain('muted-foreground');
  });
});

// ─── getWeatherHexColor ───────────────────────────────────────────────────────

describe('getWeatherHexColor', () => {
  it('returns slate fallback for undefined', () => {
    expect(getWeatherHexColor(undefined)).toBe('#cbd5e1');
  });

  it('returns sky-400 for clear sky (code 0)', () => {
    expect(getWeatherHexColor(0)).toBe('#38bdf8');
  });

  it('returns slate-400 for partly cloudy (code 2)', () => {
    expect(getWeatherHexColor(2)).toBe('#94a3b8');
  });

  it('returns slate-300 for fog (code 45)', () => {
    expect(getWeatherHexColor(45)).toBe('#cbd5e1');
  });

  it('returns sky-600 for drizzle (code 53)', () => {
    expect(getWeatherHexColor(53)).toBe('#0284c7');
  });

  it('returns blue-700 for heavy rain (code 63)', () => {
    expect(getWeatherHexColor(63)).toBe('#1d4ed8');
  });

  it('returns slate-100 for snow (code 73)', () => {
    expect(getWeatherHexColor(73)).toBe('#f1f5f9');
  });

  it('returns indigo-900 for thunderstorm (code 96)', () => {
    expect(getWeatherHexColor(96)).toBe('#312e81');
  });

  it('returns fallback for unlisted code', () => {
    expect(getWeatherHexColor(10)).toBe('#cbd5e1');
  });
});

// ─── getWeatherEmoji ──────────────────────────────────────────────────────────

describe('getWeatherEmoji', () => {
  it('returns thermometer when no code provided', () => {
    expect(getWeatherEmoji(undefined)).toBe('🌡️');
  });

  it('returns sunny emoji when temp > 25°C regardless of code', () => {
    expect(getWeatherEmoji(3, 30)).toBe('☀️');
  });

  it('returns rainy emoji when precipitation > 40% (and temp not hot)', () => {
    expect(getWeatherEmoji(2, 20, 50)).toBe('🌧️');
  });

  it('returns cloudy emoji for code > 3 with no hot temp or heavy precip', () => {
    expect(getWeatherEmoji(45, 15, 10)).toBe('☁️');
  });

  it('returns partly sunny for clear/partly-cloudy (code <= 3) with no overrides', () => {
    expect(getWeatherEmoji(1, 20, 10)).toBe('🌤️');
  });

  it('temp > 25 takes priority over precipitation check', () => {
    // Both conditions triggered — temp wins (checked first)
    expect(getWeatherEmoji(3, 30, 60)).toBe('☀️');
  });

  it('returns partly sunny for code 0 (no temp/precip given)', () => {
    expect(getWeatherEmoji(0)).toBe('🌤️');
  });
});

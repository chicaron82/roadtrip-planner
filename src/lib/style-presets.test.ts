import { describe, it, expect, afterEach } from 'vitest';
import { CHICHARON_CLASSIC, BUILTIN_PRESETS, parsePresetFromURL } from './style-presets';

// ─── Built-in presets ─────────────────────────────────────────────────────────

describe('CHICHARON_CLASSIC', () => {
  it('has the correct id', () => {
    expect(CHICHARON_CLASSIC.id).toBe('chicharon-classic');
  });

  it('has a hotel price per night', () => {
    expect(CHICHARON_CLASSIC.hotelPricePerNight).toBeGreaterThan(0);
  });

  it('has a meal price per day', () => {
    expect(CHICHARON_CLASSIC.mealPricePerDay).toBeGreaterThan(0);
  });

  it('is marked as builtin', () => {
    expect(CHICHARON_CLASSIC.builtin).toBe(true);
  });

  it('has a creator name', () => {
    expect(CHICHARON_CLASSIC.creatorName).toBeTruthy();
  });

  it('has a human-readable name', () => {
    expect(CHICHARON_CLASSIC.name).toBeTruthy();
  });

  it('has a description', () => {
    expect(CHICHARON_CLASSIC.description).toBeTruthy();
  });
});

describe('BUILTIN_PRESETS', () => {
  it('contains at least one preset', () => {
    expect(BUILTIN_PRESETS.length).toBeGreaterThan(0);
  });

  it('includes CHICHARON_CLASSIC', () => {
    const found = BUILTIN_PRESETS.find(p => p.id === 'chicharon-classic');
    expect(found).toBeDefined();
  });

  it('all presets have valid hotel prices', () => {
    BUILTIN_PRESETS.forEach(p => expect(p.hotelPricePerNight).toBeGreaterThan(0));
  });

  it('all presets have valid meal prices', () => {
    BUILTIN_PRESETS.forEach(p => expect(p.mealPricePerDay).toBeGreaterThan(0));
  });
});

// ─── parsePresetFromURL ────────────────────────────────────────────────────────

/** Build a URL-safe encoded preset using the same logic as style-presets.ts internal encodePreset. */
function encodeTestPreset(payload: object): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binStr = Array.from(bytes, b => String.fromCodePoint(b)).join('');
  return btoa(binStr);
}

afterEach(() => {
  // Reset URL back to bare path after each test
  window.history.pushState(null, '', '/');
});

describe('parsePresetFromURL', () => {
  it('returns null when no ?style= param is present', () => {
    window.history.pushState(null, '', '/');
    expect(parsePresetFromURL()).toBeNull();
  });

  it('returns null for an invalid / garbage encoded string', () => {
    window.history.pushState(null, '', '/?style=not-valid-base64!!!');
    expect(parsePresetFromURL()).toBeNull();
  });

  it('returns null when encoded payload is missing id field', () => {
    const encoded = encodeTestPreset({ v: 1, n: 'Test', cn: 'Tester', h: 150, m: 50 });
    window.history.pushState(null, '', `/?style=${encoded}`);
    expect(parsePresetFromURL()).toBeNull();
  });

  it('returns null when encoded payload is missing name field', () => {
    const encoded = encodeTestPreset({ v: 1, id: 'test-id', cn: 'Tester', h: 150, m: 50 });
    window.history.pushState(null, '', `/?style=${encoded}`);
    expect(parsePresetFromURL()).toBeNull();
  });

  it('returns null when version field is wrong', () => {
    const encoded = encodeTestPreset({ v: 99, id: 'test-id', n: 'Test', cn: 'Tester', h: 150, m: 50 });
    window.history.pushState(null, '', `/?style=${encoded}`);
    expect(parsePresetFromURL()).toBeNull();
  });

  it('decodes a valid preset from the URL', () => {
    const encoded = encodeTestPreset({ v: 1, id: 'test-id', n: 'Test Style', cn: 'Tester', h: 180, m: 65 });
    window.history.pushState(null, '', `/?style=${encoded}`);
    const result = parsePresetFromURL();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('test-id');
    expect(result!.name).toBe('Test Style');
    expect(result!.creatorName).toBe('Tester');
    expect(result!.hotelPricePerNight).toBe(180);
    expect(result!.mealPricePerDay).toBe(65);
  });

  it('roundtrips: encoded preset decodes to the original values', () => {
    const original = { v: 1, id: 'roundtrip-id', n: 'RT Preset', cn: 'Aaron', h: 200, m: 75, d: 'Test description' };
    const encoded = encodeTestPreset(original);
    window.history.pushState(null, '', `/?style=${encoded}`);
    const decoded = parsePresetFromURL();
    expect(decoded!.id).toBe(original.id);
    expect(decoded!.name).toBe(original.n);
    expect(decoded!.creatorName).toBe(original.cn);
    expect(decoded!.hotelPricePerNight).toBe(original.h);
    expect(decoded!.mealPricePerDay).toBe(original.m);
    expect(decoded!.description).toBe(original.d);
  });

  it('falls back gracefully when creatorName field is missing', () => {
    const encoded = encodeTestPreset({ v: 1, id: 'test-id', n: 'No Creator', h: 100, m: 40 });
    window.history.pushState(null, '', `/?style=${encoded}`);
    const result = parsePresetFromURL();
    expect(result).not.toBeNull();
    expect(result!.creatorName).toBe('Traveller'); // fallback value
  });

  it('falls back gracefully when hotel price is missing (uses 150)', () => {
    const encoded = encodeTestPreset({ v: 1, id: 'test-id', n: 'No Price', cn: 'Tester' });
    window.history.pushState(null, '', `/?style=${encoded}`);
    const result = parsePresetFromURL();
    expect(result!.hotelPricePerNight).toBe(150);
  });

  it('handles preset names with special characters', () => {
    const encoded = encodeTestPreset({ v: 1, id: 'special', n: "Café & Scenic Tour", cn: 'Chicharon', h: 150, m: 60 });
    window.history.pushState(null, '', `/?style=${encoded}`);
    const result = parsePresetFromURL();
    expect(result!.name).toBe("Café & Scenic Tour");
  });
});

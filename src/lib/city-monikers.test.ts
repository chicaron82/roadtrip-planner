import { describe, it, expect } from 'vitest';
import { getCityMoniker, CITY_MONIKERS } from './city-monikers';

describe('getCityMoniker', () => {
  // ── Known cities with forceMoniker ──────────────────────────────────────

  it('returns moniker for known Canadian cities with forceMoniker', () => {
    expect(getCityMoniker('Winnipeg',    { forceMoniker: true })).toBe('The Peg');
    expect(getCityMoniker('Toronto',     { forceMoniker: true })).toBe('The 6ix');
    expect(getCityMoniker('Calgary',     { forceMoniker: true })).toBe('Cowtown');
    expect(getCityMoniker('Thunder Bay', { forceMoniker: true })).toBe('T-Bay');
    expect(getCityMoniker('Medicine Hat',{ forceMoniker: true })).toBe('The Hat');
    expect(getCityMoniker('Sudbury',     { forceMoniker: true })).toBe('The Nickel City');
    expect(getCityMoniker('Lethbridge',  { forceMoniker: true })).toBe('The Bridge');
  });

  it('returns moniker for known US cities with forceMoniker', () => {
    expect(getCityMoniker('New York',    { forceMoniker: true })).toBe('The Big Apple');
    expect(getCityMoniker('Chicago',     { forceMoniker: true })).toBe('The Windy City');
    expect(getCityMoniker('Las Vegas',   { forceMoniker: true })).toBe('Sin City');
    expect(getCityMoniker('New Orleans', { forceMoniker: true })).toBe('The Big Easy');
    expect(getCityMoniker('Nashville',   { forceMoniker: true })).toBe('Music City');
  });

  // ── Alias lookup ────────────────────────────────────────────────────────

  it('handles "New York City" alias', () => {
    expect(getCityMoniker('New York City', { forceMoniker: true })).toBe('The Big Apple');
  });

  // ── Unknown cities ───────────────────────────────────────────────────────

  it('falls back to city name for unknown cities', () => {
    expect(getCityMoniker('Virden')).toBe('Virden');
    expect(getCityMoniker('Selkirk')).toBe('Selkirk');
    expect(getCityMoniker('Pinawa')).toBe('Pinawa');
    expect(getCityMoniker('Steinbach')).toBe('Steinbach');
  });

  // ── Trimming ─────────────────────────────────────────────────────────────

  it('trims city name before lookup', () => {
    expect(getCityMoniker('  Winnipeg  ', { forceMoniker: true })).toBe('The Peg');
    expect(getCityMoniker('  Thunder Bay  ', { forceMoniker: true })).toBe('T-Bay');
  });

  // ── Empty / edge cases ───────────────────────────────────────────────────

  it('returns empty string for empty input', () => {
    expect(getCityMoniker('')).toBe('');
  });

  // ── Sanity: all entries have a non-empty moniker string ──────────────────

  it('every CITY_MONIKERS entry has a non-empty moniker', () => {
    for (const [city, entry] of Object.entries(CITY_MONIKERS)) {
      expect(entry.moniker.length, `${city} has empty moniker`).toBeGreaterThan(0);
    }
  });

  // ── "The X" double-article guard ─────────────────────────────────────────
  // Tested via the template behavior in trip-title-seeds — the guard lives there.
  // Here we just confirm that monikers starting with "The" exist in the dict
  // so that the guard in the seed templates has something to protect against.

  it('has monikers starting with "The" that would trigger the double-article guard', () => {
    const theEntries = Object.values(CITY_MONIKERS).filter(e => e.moniker.startsWith('The'));
    expect(theEntries.length).toBeGreaterThan(0);
  });
});

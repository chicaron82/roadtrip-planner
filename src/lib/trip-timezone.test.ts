import { describe, expect, it } from 'vitest';
import {
  formatDateInZone,
  formatDisplayDateInZone,
  formatTimeInZone,
  getTripStartTime,
  lngToIANA,
  normalizeToIANA,
  parseLocalDateInTZ,
} from './trip-timezone';

describe('getTripStartTime', () => {
  it('matches explicit timezone parsing when origin longitude is known', () => {
    const viaHelper = getTripStartTime('2026-08-01', '08:00', -97.138);
    const direct = parseLocalDateInTZ('2026-08-01', '08:00', 'America/Winnipeg');

    expect(viaHelper.toISOString()).toBe(direct.toISOString());
  });

  it('falls back to legacy parsing when origin longitude is missing', () => {
    const fallback = getTripStartTime('2026-08-01', '08:00');
    expect(fallback).toBeInstanceOf(Date);
    expect(Number.isNaN(fallback.getTime())).toBe(false);
  });
});

describe('offset timezone formatting', () => {
  it('preserves GMT offsets as supported display tokens', () => {
    expect(normalizeToIANA(' GMT-5 ')).toBe('GMT-5');
    expect(normalizeToIANA('utc+05:30')).toBe('UTC+05:30');
  });

  it('formats times using raw GMT offsets without crashing', () => {
    const date = new Date('2026-01-01T15:00:00Z');

    expect(formatTimeInZone(date, 'GMT-5')).toBe('10:00 AM');
    expect(formatTimeInZone(date, 'UTC+05:30')).toBe('8:30 PM');
  });

  it('rolls dates correctly when using offset-style timezones', () => {
    const date = new Date('2026-01-01T02:00:00Z');

    expect(formatDateInZone(date, 'GMT-5')).toBe('2025-12-31');
    expect(formatDisplayDateInZone(date, 'GMT-5')).toBe('Wed, Dec 31');
  });

  it('falls back safely for unknown timezone strings', () => {
    const date = new Date('2026-01-01T15:00:00Z');

    expect(() => formatTimeInZone(date, 'Mars/Olympus')).not.toThrow();
    expect(() => formatDisplayDateInZone(date, 'Mars/Olympus')).not.toThrow();
  });
});

describe('lngToIANA — Atlantic and Newfoundland edge cases', () => {
  // Lines 34-35 in trip-timezone.ts — the two easternmost Canadian zones
  it('returns America/Halifax for Atlantic-time longitudes (-65°, New Brunswick coast)', () => {
    expect(lngToIANA(-65)).toBe('America/Halifax');
  });

  it('returns America/St_Johns for Newfoundland longitudes (-52°, St. John\'s NL)', () => {
    expect(lngToIANA(-52)).toBe('America/St_Johns');
  });

  it('maps the full western Canada span correctly', () => {
    // Spot-checks for the other branches to confirm the table is consistent
    expect(lngToIANA(-145)).toBe('America/Anchorage');  // inside Alaska corridor
    expect(lngToIANA(-125)).toBe('America/Vancouver');  // BC coast
    expect(lngToIANA(-114)).toBe('America/Edmonton');   // AB
    expect(lngToIANA(-106)).toBe('America/Regina');     // SK
    expect(lngToIANA(-95)).toBe('America/Winnipeg');    // MB
    expect(lngToIANA(-79)).toBe('America/Toronto');     // ON
  });
});

describe('normalizeToIANA — abbreviation lookup and passthrough', () => {
  // Line 115: TZ_ABBR_TO_IANA lookup (previously uncovered)
  it('maps a known weather-API abbreviation to its IANA string (CST → America/Winnipeg)', () => {
    expect(normalizeToIANA('CST')).toBe('America/Winnipeg');
  });

  it('maps PST → America/Vancouver', () => {
    expect(normalizeToIANA('PST')).toBe('America/Vancouver');
  });

  it('maps EST → America/Toronto', () => {
    expect(normalizeToIANA('EST')).toBe('America/Toronto');
  });

  // Line 117: passthrough for an already-IANA string (previously uncovered)
  it('passes through an already-valid IANA name unchanged', () => {
    expect(normalizeToIANA('America/Toronto')).toBe('America/Toronto');
    expect(normalizeToIANA('America/Vancouver')).toBe('America/Vancouver');
  });
});
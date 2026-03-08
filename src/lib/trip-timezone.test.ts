import { describe, expect, it } from 'vitest';
import {
  formatDateInZone,
  formatDisplayDateInZone,
  formatTimeInZone,
  getTripStartTime,
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
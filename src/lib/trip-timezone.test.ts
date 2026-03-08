import { describe, expect, it } from 'vitest';
import { getTripStartTime, parseLocalDateInTZ } from './trip-timezone';

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
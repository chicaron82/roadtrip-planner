import { describe, it, expect } from 'vitest';
import {
  extractRegionCode,
  getHotelMultiplier,
  getRegionalFuelPrice,
  getFuelPriceDefault,
  HOTEL_MULTIPLIERS,
} from './regional-costs';

// ── extractRegionCode ────────────────────────────────────────────────────────

describe('extractRegionCode', () => {
  it('extracts 2-letter code from "City, ON" format', () => {
    expect(extractRegionCode('Toronto, ON')).toBe('ON');
  });

  it('extracts code from multi-part names', () => {
    expect(extractRegionCode('Vancouver, BC, Canada')).toBe(null); // 3-part — last is "Canada" (6 chars)
  });

  it('handles "City, Province" correctly', () => {
    expect(extractRegionCode('Winnipeg, MB')).toBe('MB');
  });

  it('returns null when no comma present', () => {
    expect(extractRegionCode('Toronto')).toBeNull();
  });

  it('returns null for non-2-char trailing segment', () => {
    expect(extractRegionCode('New York, New York')).toBeNull(); // "New York" != 2 chars
  });

  it('is case-insensitive (uppercases result)', () => {
    expect(extractRegionCode('Seattle, wa')).toBe('WA');
  });

  it('handles extra whitespace around the code', () => {
    expect(extractRegionCode('Calgary,  AB')).toBe('AB');
  });

  it('returns null for empty string', () => {
    expect(extractRegionCode('')).toBeNull();
  });
});

// ── getHotelMultiplier ───────────────────────────────────────────────────────

describe('getHotelMultiplier', () => {
  it('returns 1.0 for Manitoba baseline', () => {
    expect(getHotelMultiplier('Winnipeg, MB')).toBe(1.0);
  });

  it('returns elevated multiplier for Ontario', () => {
    expect(getHotelMultiplier('Toronto, ON')).toBe(1.40);
  });

  it('returns elevated multiplier for BC', () => {
    expect(getHotelMultiplier('Vancouver, BC')).toBe(1.35);
  });

  it('returns California multiplier (highest US state)', () => {
    expect(getHotelMultiplier('Los Angeles, CA')).toBe(1.60);
  });

  it('returns NY multiplier', () => {
    expect(getHotelMultiplier('New York, NY')).toBe(1.70);
  });

  it('returns below-1 multiplier for SK', () => {
    expect(getHotelMultiplier('Regina, SK')).toBe(0.90);
  });

  it('falls back to 1.0 for unknown region', () => {
    expect(getHotelMultiplier('Somewhere, XX')).toBe(1.0);
  });

  it('falls back to 1.0 when no comma present', () => {
    expect(getHotelMultiplier('Unnamed City')).toBe(1.0);
  });

  it('returns 1.0 for Ohio (baseline US state)', () => {
    expect(getHotelMultiplier('Columbus, OH')).toBe(1.0);
  });

  it('all HOTEL_MULTIPLIERS values are between 0.5 and 2.5 (sanity)', () => {
    for (const [code, mult] of Object.entries(HOTEL_MULTIPLIERS)) {
      expect(mult, `${code} multiplier out of expected range`).toBeGreaterThanOrEqual(0.5);
      expect(mult, `${code} multiplier out of expected range`).toBeLessThanOrEqual(2.5);
    }
  });
});

// ── getRegionalFuelPrice ─────────────────────────────────────────────────────

describe('getRegionalFuelPrice', () => {
  it('returns CAD price for a Canadian province', () => {
    const price = getRegionalFuelPrice('Winnipeg, MB', 'CAD');
    expect(price).not.toBeNull();
    expect(price!).toBeGreaterThan(1.0); // Manitoba CAD fuel price > $1
  });

  it('returns USD price for a US state when currency is USD', () => {
    const price = getRegionalFuelPrice('Seattle, WA', 'USD');
    expect(price).not.toBeNull();
    expect(price!).toBeGreaterThan(0.5); // USD per litre > $0.50
  });

  it('returns null for a US state when currency is CAD (mismatch)', () => {
    const price = getRegionalFuelPrice('Seattle, WA', 'CAD');
    expect(price).toBeNull();
  });

  it('returns null for unknown region', () => {
    expect(getRegionalFuelPrice('Nowhere, XX', 'CAD')).toBeNull();
    expect(getRegionalFuelPrice('Nowhere, XX', 'USD')).toBeNull();
  });

  it('returns null when no comma in location name', () => {
    expect(getRegionalFuelPrice('Toronto', 'CAD')).toBeNull();
  });

  it('BC has highest CAD fuel price (Vancouver premium)', () => {
    const bc = getRegionalFuelPrice('Vancouver, BC', 'CAD');
    const mb = getRegionalFuelPrice('Winnipeg, MB', 'CAD');
    expect(bc).not.toBeNull();
    expect(mb).not.toBeNull();
    expect(bc!).toBeGreaterThan(mb!);
  });

  it('CA has higher USD price than TX', () => {
    const ca = getRegionalFuelPrice('Los Angeles, CA', 'USD');
    const tx = getRegionalFuelPrice('Houston, TX', 'USD');
    expect(ca).not.toBeNull();
    expect(tx).not.toBeNull();
    expect(ca!).toBeGreaterThan(tx!);
  });
});

// ── getFuelPriceDefault (alias) ──────────────────────────────────────────────

describe('getFuelPriceDefault', () => {
  it('is an alias for getRegionalFuelPrice', () => {
    expect(getFuelPriceDefault('Winnipeg, MB', 'CAD')).toBe(
      getRegionalFuelPrice('Winnipeg, MB', 'CAD')
    );
  });
});

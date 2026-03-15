import { describe, it, expect } from 'vitest';
import { sanitizeLocationName } from './location-sanitizer';

describe('sanitizeLocationName', () => {
  // ── Spec examples ────────────────────────────────────────────────────────

  it('strips district and expands province from full CA postal', () => {
    expect(sanitizeLocationName('Thunder Bay, Thunder Bay District, ON P7B 6B3, Canada'))
      .toBe('Thunder Bay, Ontario');
  });

  it('strips postal from address segment, keeps province abbreviation', () => {
    expect(sanitizeLocationName('123 Main St, Winnipeg, MB R3C 1A3, Canada'))
      .toBe('123 Main St, Winnipeg, Manitoba');
  });

  it('strips improvement district and expands standalone province code', () => {
    expect(sanitizeLocationName('Banff National Park, Improvement District No. 9, AB, Canada'))
      .toBe('Banff National Park, Alberta');
  });

  it('strips Division No. and keeps full province name', () => {
    expect(sanitizeLocationName('Winnipeg, Division No. 11, Manitoba R3C, Canada'))
      .toBe('Winnipeg, Manitoba');
  });

  // ── Admin bloat variants ─────────────────────────────────────────────────

  it('strips County', () => {
    expect(sanitizeLocationName('Los Angeles, Los Angeles County, California, United States'))
      .toBe('Los Angeles, California');
  });

  it('strips District Municipality', () => {
    expect(sanitizeLocationName('North Vancouver, District Municipality, BC V7M 1A1, Canada'))
      .toBe('North Vancouver, British Columbia');
  });

  it('strips Census Division', () => {
    expect(sanitizeLocationName('Regina, Census Division No. 6, SK S4P 0A3, Canada'))
      .toBe('Regina, Saskatchewan');
  });

  it('strips Township', () => {
    expect(sanitizeLocationName('Springwater Township, Simcoe County, ON L9X 0A1, Canada'))
      .toBe('Springwater Township, Ontario');
  });

  // ── Postal code extraction ───────────────────────────────────────────────

  it('extracts state from US ZIP', () => {
    expect(sanitizeLocationName('Seattle, King County, Washington 98101, United States'))
      .toBe('Seattle, Washington');
  });

  it('handles bare 2-letter province + partial CA postal', () => {
    expect(sanitizeLocationName('Saskatoon, SK S7K, Canada'))
      .toBe('Saskatoon, Saskatchewan');
  });

  // ── Disambiguation preserved ─────────────────────────────────────────────

  it('keeps province for London Ontario to disambiguate from London UK', () => {
    const result = sanitizeLocationName('London, Middlesex County, ON N6A 3N7, Canada');
    expect(result).toBe('London, Ontario');
    expect(result).not.toBe('London');
  });

  // ── Deduplication ────────────────────────────────────────────────────────

  it('deduplicates consecutive identical segments', () => {
    // Nominatim sometimes returns the city name twice at different admin levels
    expect(sanitizeLocationName('Ottawa, Ottawa, ON K1A 0A6, Canada'))
      .toBe('Ottawa, Ontario');
  });

  // ── Clean inputs passthrough ─────────────────────────────────────────────

  it('passes through already-clean strings unchanged', () => {
    expect(sanitizeLocationName('Vancouver, British Columbia')).toBe('Vancouver, British Columbia');
  });

  it('passes through single city name', () => {
    expect(sanitizeLocationName('Montreal')).toBe('Montreal');
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  it('does not strip "District of Columbia"', () => {
    const result = sanitizeLocationName('Washington, District of Columbia, DC 20001, United States');
    expect(result).toContain('Washington');
    expect(result).toContain('District of Columbia');
  });

  it('handles empty string gracefully', () => {
    expect(sanitizeLocationName('')).toBe('');
  });

  it('expands all supported Canadian province codes', () => {
    const provinces: [string, string][] = [
      ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'],
      ['ON', 'Ontario'], ['QC', 'Quebec'], ['SK', 'Saskatchewan'],
    ];
    for (const [code, name] of provinces) {
      expect(sanitizeLocationName(`City, ${code} T1X 1A1, Canada`)).toBe(`City, ${name}`);
    }
  });
});

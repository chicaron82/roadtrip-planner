/**
 * utils.ts — unit tests for escapeHtml and formatLocalYMD.
 *
 * Pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml, formatLocalYMD } from './utils';

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('1 > 0')).toBe('1 &gt; 0');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's alive")).toBe('it&#39;s alive');
  });

  it('returns the string unchanged when no special chars', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes multiple special chars in one string', () => {
    const result = escapeHtml('<a href="test">it\'s & fun</a>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&quot;');
    expect(result).toContain('&#39;');
    expect(result).toContain('&amp;');
  });
});

// ─── formatLocalYMD ───────────────────────────────────────────────────────────

describe('formatLocalYMD', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 16); // August 16 2026 (month is 0-indexed)
    expect(formatLocalYMD(d)).toBe('2026-08-16');
  });

  it('zero-pads single-digit month', () => {
    const d = new Date(2026, 0, 15); // Jan 15
    expect(formatLocalYMD(d)).toBe('2026-01-15');
  });

  it('zero-pads single-digit day', () => {
    const d = new Date(2026, 11, 5); // Dec 5
    expect(formatLocalYMD(d)).toBe('2026-12-05');
  });

  it('returns a string matching YYYY-MM-DD pattern', () => {
    const result = formatLocalYMD(new Date());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

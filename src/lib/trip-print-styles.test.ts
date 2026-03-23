/**
 * trip-print-styles.test.ts
 *
 * Structural/contract tests for PRINT_STYLES.
 * The file is a CSS string — no logic to unit-test. These tests exist to:
 *   1. Catch accidental truncation or corruption of the string.
 *   2. Document the CSS selectors the print HTML builder depends on.
 *   3. Enforce print-critical properties (colour fidelity, page sizing).
 */
import { describe, expect, it } from 'vitest';
import { PRINT_STYLES } from './trip-print-styles';

// ─── Smoke ──────────────────────────────────────────────────────────────────

describe('PRINT_STYLES smoke', () => {
  it('is a non-empty string', () => {
    expect(typeof PRINT_STYLES).toBe('string');
    expect(PRINT_STYLES.length).toBeGreaterThan(100);
  });

  it('has balanced braces (not accidentally truncated)', () => {
    const open = (PRINT_STYLES.match(/\{/g) ?? []).length;
    const close = (PRINT_STYLES.match(/\}/g) ?? []).length;
    expect(open).toBeGreaterThan(0);
    expect(open).toBe(close);
  });
});

// ─── Print-critical rules ────────────────────────────────────────────────────

describe('PRINT_STYLES — print-critical rules', () => {
  it('includes colour-adjust reset to ensure colours print accurately', () => {
    expect(PRINT_STYLES).toContain('print-color-adjust: exact');
    expect(PRINT_STYLES).toContain('-webkit-print-color-adjust: exact');
  });

  it('defines @page size as A4 portrait', () => {
    expect(PRINT_STYLES).toContain('@page');
    expect(PRINT_STYLES).toContain('A4 portrait');
  });

  it('sets a page margin via @page', () => {
    // Margin must be present — zero-margin prints bleed off the edge.
    const pageBlock = PRINT_STYLES.slice(
      PRINT_STYLES.indexOf('@page'),
      PRINT_STYLES.indexOf('}', PRINT_STYLES.indexOf('@page')) + 1,
    );
    expect(pageBlock).toContain('margin:');
  });

  it('includes page-break-inside: avoid on .day-section', () => {
    expect(PRINT_STYLES).toContain('page-break-inside: avoid');
  });
});

// ─── Day layout selectors ────────────────────────────────────────────────────

describe('PRINT_STYLES — day layout selectors', () => {
  it('defines .day-section', () => {
    expect(PRINT_STYLES).toContain('.day-section');
  });

  it('defines .day-header', () => {
    expect(PRINT_STYLES).toContain('.day-header');
  });

  it('defines .day-title', () => {
    expect(PRINT_STYLES).toContain('.day-title');
  });

  it('defines .day-route', () => {
    expect(PRINT_STYLES).toContain('.day-route');
  });

  it('defines .day-stats', () => {
    expect(PRINT_STYLES).toContain('.day-stats');
  });
});

// ─── Event timeline selectors ────────────────────────────────────────────────

describe('PRINT_STYLES — event timeline selectors', () => {
  it('defines .event', () => {
    expect(PRINT_STYLES).toContain('.event');
  });

  it('defines .event-time for timestamp column', () => {
    expect(PRINT_STYLES).toContain('.event-time');
  });

  it('defines .event-body', () => {
    expect(PRINT_STYLES).toContain('.event-body');
  });

  it('defines .event.departure and .event.arrival', () => {
    expect(PRINT_STYLES).toContain('.event.departure');
    expect(PRINT_STYLES).toContain('.event.arrival');
  });

  it('defines .event.fuel highlighting', () => {
    expect(PRINT_STYLES).toContain('.event.fuel');
  });

  it('defines .event.meal highlighting', () => {
    expect(PRINT_STYLES).toContain('.event.meal');
  });
});

// ─── Hotel card selectors ────────────────────────────────────────────────────

describe('PRINT_STYLES — hotel card selectors', () => {
  it('defines .hotel-card', () => {
    expect(PRINT_STYLES).toContain('.hotel-card');
  });

  it('defines .hotel-name', () => {
    expect(PRINT_STYLES).toContain('.hotel-name');
  });

  it('defines .hotel-detail', () => {
    expect(PRINT_STYLES).toContain('.hotel-detail');
  });
});

// ─── Budget overview ─────────────────────────────────────────────────────────

describe('PRINT_STYLES — budget overview selectors', () => {
  it('defines .budget-overview', () => {
    expect(PRINT_STYLES).toContain('.budget-overview');
  });

  it('defines .stats-row', () => {
    expect(PRINT_STYLES).toContain('.stats-row');
  });

  it('defines .overview', () => {
    expect(PRINT_STYLES).toContain('.overview');
  });
});

// ─── Journal section selectors ───────────────────────────────────────────────

describe('PRINT_STYLES — journal section selectors', () => {
  it('defines .journal-section', () => {
    expect(PRINT_STYLES).toContain('.journal-section');
  });

  it('defines .journal-entry', () => {
    expect(PRINT_STYLES).toContain('.journal-entry');
  });

  it('defines .journal-photo for embedded photo layout', () => {
    expect(PRINT_STYLES).toContain('.journal-photo');
  });
});

// ─── Typography guards ───────────────────────────────────────────────────────

describe('PRINT_STYLES — typography', () => {
  it('sets a base font-family on body', () => {
    const bodyBlock = PRINT_STYLES.slice(
      PRINT_STYLES.indexOf('\n  body'),
      PRINT_STYLES.indexOf('\n  }', PRINT_STYLES.indexOf('\n  body')) + 4,
    );
    expect(bodyBlock).toContain('font-family');
  });

  it('sets a base font-size (in pt) on body', () => {
    const bodyBlock = PRINT_STYLES.slice(
      PRINT_STYLES.indexOf('\n  body'),
      PRINT_STYLES.indexOf('\n  }', PRINT_STYLES.indexOf('\n  body')) + 4,
    );
    expect(bodyBlock).toMatch(/font-size:\s*\d+pt/);
  });

  it('uses pt units for font sizes (not px, for print fidelity)', () => {
    // The styles should primarily use pt — px is screen-relative and unreliable in print.
    const ptMatches = (PRINT_STYLES.match(/\d+pt/g) ?? []).length;
    const pxFontMatches = (PRINT_STYLES.match(/font-size:\s*\d+px/g) ?? []).length;
    expect(ptMatches).toBeGreaterThan(5);
    expect(pxFontMatches).toBe(0);
  });
});

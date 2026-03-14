/**
 * mee-tokens.ts — unit tests
 *
 * Pure functions — no mocks needed.
 * Covers: SOURCE_TIER_RANK, SOURCE_TIER_CHIP_WEIGHT, buildHealthPhrase,
 *         buildTripRead, buildAutoTitle, buildWarningLine, buildDiscoveryLine,
 *         buildVerifiedLine, GUIDANCE constants.
 */

import { describe, it, expect } from 'vitest';
import {
  SOURCE_TIER_RANK,
  SOURCE_TIER_CHIP_WEIGHT,
  SOURCE_TIER_LABELS,
  GUIDANCE,
  buildHealthPhrase,
  buildTripRead,
  buildAutoTitle,
  buildWarningLine,
  buildDiscoveryLine,
  buildVerifiedLine,
} from './mee-tokens';

// ─── Source tier authority ordering ──────────────────────────────────────────

describe('SOURCE_TIER_RANK', () => {
  it('declared outranks verified', () => {
    expect(SOURCE_TIER_RANK.declared).toBeGreaterThan(SOURCE_TIER_RANK.verified);
  });

  it('verified outranks inferred', () => {
    expect(SOURCE_TIER_RANK.verified).toBeGreaterThan(SOURCE_TIER_RANK.inferred);
  });

  it('inferred outranks discovered', () => {
    expect(SOURCE_TIER_RANK.inferred).toBeGreaterThan(SOURCE_TIER_RANK.discovered);
  });

  it('all four tiers have distinct rank values', () => {
    const ranks = Object.values(SOURCE_TIER_RANK);
    expect(new Set(ranks).size).toBe(4);
  });
});

// ─── Chip weight by tier ──────────────────────────────────────────────────────

describe('SOURCE_TIER_CHIP_WEIGHT', () => {
  it('declared uses solid chip', () => {
    expect(SOURCE_TIER_CHIP_WEIGHT.declared).toBe('solid');
  });

  it('verified uses solid chip (evidence-backed)', () => {
    expect(SOURCE_TIER_CHIP_WEIGHT.verified).toBe('solid');
  });

  it('inferred uses outlined chip (secondary)', () => {
    expect(SOURCE_TIER_CHIP_WEIGHT.inferred).toBe('outlined');
  });

  it('discovered uses ghost chip (optional)', () => {
    expect(SOURCE_TIER_CHIP_WEIGHT.discovered).toBe('ghost');
  });
});

// ─── Label constants ──────────────────────────────────────────────────────────

describe('SOURCE_TIER_LABELS', () => {
  it('declared label is "Declared"', () => {
    expect(SOURCE_TIER_LABELS.declared).toBe('Declared');
  });

  it('inferred label is "Estimated by MEE"', () => {
    expect(SOURCE_TIER_LABELS.inferred).toBe('Estimated by MEE');
  });

  it('discovered label is "Suggested by MEE"', () => {
    expect(SOURCE_TIER_LABELS.discovered).toBe('Suggested by MEE');
  });

  it('meeWillInfer label is "MEE will infer"', () => {
    expect(SOURCE_TIER_LABELS.meeWillInfer).toBe('MEE will infer');
  });

  it('worthALook label is "Worth a look"', () => {
    expect(SOURCE_TIER_LABELS.worthALook).toBe('Worth a look');
  });

  it('no label contains banned vocabulary', () => {
    const banned = ['AI-generated', 'auto-generated', 'system-generated', 'derived'];
    const all = Object.values(SOURCE_TIER_LABELS);
    for (const label of all) {
      for (const word of banned) {
        expect(label).not.toContain(word);
      }
    }
  });
});

// ─── buildHealthPhrase ────────────────────────────────────────────────────────

describe('buildHealthPhrase', () => {
  it('returns "A long push" when status is over', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'over', numDrivers: 1, longestDriveHours: 14, totalDays: 3 }))
      .toBe('A long push');
  });

  it('returns "Ambitious but workable" when status is tight', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'tight', numDrivers: 1, longestDriveHours: 9, totalDays: 3 }))
      .toBe('Ambitious but workable');
  });

  it('returns "Shared-driver friendly" for on-track with 2 drivers and ≤10h', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'on-track', numDrivers: 2, longestDriveHours: 8, totalDays: 3 }))
      .toBe('Shared-driver friendly');
  });

  it('returns "Strong shared-driver fit" for on-track with 2 drivers and >10h', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'on-track', numDrivers: 2, longestDriveHours: 11, totalDays: 3 }))
      .toBe('Strong shared-driver fit');
  });

  it('returns "Comfort-first" for on-track solo ≤6h', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'on-track', numDrivers: 1, longestDriveHours: 5, totalDays: 2 }))
      .toBe('Comfort-first');
  });

  it('returns "Balanced" for on-track solo 7-8h', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'on-track', numDrivers: 1, longestDriveHours: 7, totalDays: 3 }))
      .toBe('Balanced');
  });

  it('returns "Heavy driving day" for on-track solo >8h', () => {
    expect(buildHealthPhrase({ feasibilityStatus: 'on-track', numDrivers: 1, longestDriveHours: 10, totalDays: 3 }))
      .toBe('Heavy driving day');
  });
});

// ─── buildTripRead ────────────────────────────────────────────────────────────

describe('buildTripRead', () => {
  const base = { days: 3, destination: 'Thunder Bay', feasibilityStatus: 'on-track' as const, numDrivers: 1, longestDriveHours: 7 };

  it('produces an interpretive sentence, not raw data echo', () => {
    const result = buildTripRead(base);
    expect(result).not.toMatch(/^Thunder Bay/); // destination not the first word
    expect(result).toContain('Thunder Bay');
    expect(result).toMatch(/[A-Z].*\./); // starts with capital, ends with period
  });

  it('includes day count', () => {
    expect(buildTripRead(base)).toContain('3-day');
  });

  it('mentions driver note when status is over and 2+ drivers', () => {
    const result = buildTripRead({ ...base, feasibilityStatus: 'over', numDrivers: 2, longestDriveHours: 14 });
    expect(result).toMatch(/two drivers/i);
  });

  it('suggests overnight when status is over and solo', () => {
    const result = buildTripRead({ ...base, feasibilityStatus: 'over', numDrivers: 1, longestDriveHours: 14 });
    expect(result).toMatch(/overnight/i);
  });

  it('mentions shared driving when tight + 2 drivers', () => {
    const result = buildTripRead({ ...base, feasibilityStatus: 'tight', numDrivers: 2, longestDriveHours: 9 });
    expect(result).toMatch(/shared driving/i);
  });

  it('includes reset point name when hasNamedResetPoint is set', () => {
    const result = buildTripRead({ ...base, hasNamedResetPoint: 'Dryden' });
    expect(result).toContain('Dryden');
    expect(result).toMatch(/reset/i);
  });

  it('one-way does not say "loop"', () => {
    const oneWay = buildTripRead({ ...base, isRoundTrip: false });
    expect(oneWay).not.toMatch(/\bloop\b/);
  });

  it('uses comfort-first language for short drives', () => {
    const result = buildTripRead({ ...base, longestDriveHours: 5 });
    expect(result).toMatch(/comfort/i);
  });

  it('ends with a period', () => {
    expect(buildTripRead(base)).toMatch(/\.$/);
  });
});

// ─── buildAutoTitle ───────────────────────────────────────────────────────────

describe('buildAutoTitle', () => {
  it('returns "Your MEE time in [destination]" format', () => {
    const result = buildAutoTitle({ destination: 'Thunder Bay' });
    expect(result).toBe('Your MEE time in Thunder Bay');
  });

  it('appends departure date when provided', () => {
    const result = buildAutoTitle({ destination: 'Thunder Bay', departureDate: 'Sep 12' });
    expect(result).toBe('Your MEE time in Thunder Bay · Sep 12');
  });

  it('works without date', () => {
    expect(buildAutoTitle({ destination: 'Banff' })).toBe('Your MEE time in Banff');
  });

  it('contains "MEE" as the brand signature', () => {
    expect(buildAutoTitle({ destination: 'Ottawa' })).toContain('MEE');
  });
});

// ─── buildWarningLine ─────────────────────────────────────────────────────────

describe('buildWarningLine', () => {
  it('acknowledges overnight anchor when solo and very long drive', () => {
    const result = buildWarningLine({ numDrivers: 1, longestDriveHours: 13, hasOvernightAnchor: true });
    expect(result).toMatch(/overnight/i);
    expect(result).toMatch(/helps/i);
  });

  it('recommends overnight when solo and very long drive without anchor', () => {
    const result = buildWarningLine({ numDrivers: 1, longestDriveHours: 13, hasOvernightAnchor: false });
    expect(result).toMatch(/overnight/i);
  });

  it('notes solo driver strain for 9-12h drives', () => {
    const result = buildWarningLine({ numDrivers: 1, longestDriveHours: 9, hasOvernightAnchor: false });
    expect(result).toMatch(/solo driver/i);
  });

  it('suggests reset point when >10h and no overnight', () => {
    const result = buildWarningLine({ numDrivers: 1, longestDriveHours: 11, hasOvernightAnchor: false });
    expect(result).toMatch(/reset/i);
  });

  it('reassures when two drivers are available', () => {
    const result = buildWarningLine({ numDrivers: 2, longestDriveHours: 7, hasOvernightAnchor: false });
    expect(result).toMatch(/shared driving/i);
  });

  it('never uses banned vocabulary', () => {
    const banned = ['amazing', 'awesome', 'perfect', 'generated', 'optimized'];
    const contexts = [
      { numDrivers: 1, longestDriveHours: 14, hasOvernightAnchor: false },
      { numDrivers: 2, longestDriveHours: 8, hasOvernightAnchor: true },
    ];
    for (const ctx of contexts) {
      const result = buildWarningLine(ctx).toLowerCase();
      for (const word of banned) {
        expect(result).not.toContain(word);
      }
    }
  });
});

// ─── buildDiscoveryLine ───────────────────────────────────────────────────────

describe('buildDiscoveryLine', () => {
  it('mentions detour time when ≤20 min', () => {
    const result = buildDiscoveryLine({ name: 'Kakabeka Falls', detourMinutes: 15 });
    expect(result).toContain('15 min');
    expect(result).toMatch(/worth a look/i);
  });

  it('suggests "good detour" for 21-45 min', () => {
    const result = buildDiscoveryLine({ name: 'Kakabeka Falls', detourMinutes: 30 });
    expect(result).toMatch(/detour/i);
  });

  it('returns "Worth a look." when no detour time', () => {
    const result = buildDiscoveryLine({ name: 'Kakabeka Falls' });
    expect(result).toBe('Worth a look.');
  });

  it('never sounds like an ad or requirement', () => {
    const result = buildDiscoveryLine({ name: 'Test', detourMinutes: 10 });
    expect(result).not.toMatch(/must|required|don't miss|amazing/i);
  });
});

// ─── buildVerifiedLine ────────────────────────────────────────────────────────

describe('buildVerifiedLine', () => {
  it('returns "From a real trip" when no name given', () => {
    expect(buildVerifiedLine()).toBe('From a real trip');
  });

  it('includes trip name when provided', () => {
    const result = buildVerifiedLine('Canadian EuroTrip (2025)');
    expect(result).toContain('Canadian EuroTrip (2025)');
    expect(result).toMatch(/Verified from/);
  });
});

// ─── GUIDANCE constants ───────────────────────────────────────────────────────

describe('GUIDANCE', () => {
  it('title prompt invites authorship without being prescriptive', () => {
    expect(GUIDANCE.titlePrompt).toContain('MEE');
    expect(GUIDANCE.titlePrompt).not.toMatch(/required|must|fill/i);
  });

  it('auto mode copy does not say "easy mode"', () => {
    expect(GUIDANCE.modeAuto).not.toMatch(/easy/i);
    expect(GUIDANCE.modeManual).not.toMatch(/advanced/i);
  });

  it('meeWillInfer fallback contains "MEE"', () => {
    expect(GUIDANCE.inferredFallback).toContain('MEE');
  });
});

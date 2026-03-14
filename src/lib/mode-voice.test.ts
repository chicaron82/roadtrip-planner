/**
 * mode-voice — unit tests
 *
 * Pure functions — no DOM, no rendering.
 */

import { describe, it, expect } from 'vitest';
import { buildResultsFramingLine, buildConfirmSubline } from './mode-voice';

// ── buildResultsFramingLine ───────────────────────────────────────────────────

describe('buildResultsFramingLine', () => {
  it('returns engine-confidence copy for adventure mode', () => {
    const line = buildResultsFramingLine('adventure');
    expect(line).toContain('intent');
    // engine-forward — should not say "your route structure"
    expect(line).not.toContain('Your route structure');
  });

  it('returns authorship copy for plan mode', () => {
    const line = buildResultsFramingLine('plan');
    expect(line).toContain('Your route structure');
    // user-forward — should not say "your intent"
    expect(line).not.toContain('your intent');
  });

  it('returns authorship copy for estimate mode (fallback to plan)', () => {
    const line = buildResultsFramingLine('estimate');
    expect(line).toContain('Your route structure');
  });

  it('adventure and plan lines are different strings', () => {
    expect(buildResultsFramingLine('adventure')).not.toBe(buildResultsFramingLine('plan'));
  });

  it('plan and estimate lines are identical (estimate uses plan copy)', () => {
    expect(buildResultsFramingLine('plan')).toBe(buildResultsFramingLine('estimate'));
  });

  it('returns a non-empty string for all modes', () => {
    (['adventure', 'plan', 'estimate'] as const).forEach(mode => {
      expect(buildResultsFramingLine(mode).length).toBeGreaterThan(0);
    });
  });
});

// ── buildConfirmSubline ───────────────────────────────────────────────────────

describe('buildConfirmSubline', () => {
  it('returns MEE-contribution copy for adventure mode', () => {
    const line = buildConfirmSubline('adventure');
    expect(line).toContain('MEE built this');
    // should not mention "You shaped"
    expect(line).not.toContain('You shaped');
  });

  it('returns user-authorship copy for plan mode', () => {
    const line = buildConfirmSubline('plan');
    expect(line).toContain('You shaped');
    // should not say "MEE built this"
    expect(line).not.toContain('MEE built this');
  });

  it('returns authorship copy for estimate mode (fallback to plan)', () => {
    const line = buildConfirmSubline('estimate');
    expect(line).toContain('You shaped');
  });

  it('adventure and plan sublines are different strings', () => {
    expect(buildConfirmSubline('adventure')).not.toBe(buildConfirmSubline('plan'));
  });

  it('plan and estimate sublines are identical (estimate uses plan copy)', () => {
    expect(buildConfirmSubline('plan')).toBe(buildConfirmSubline('estimate'));
  });

  it('returns a non-empty string for all modes', () => {
    (['adventure', 'plan', 'estimate'] as const).forEach(mode => {
      expect(buildConfirmSubline(mode).length).toBeGreaterThan(0);
    });
  });
});

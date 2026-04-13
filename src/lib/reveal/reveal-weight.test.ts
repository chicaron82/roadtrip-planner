/**
 * reveal-weight.test.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectRevealMode,
  computeRevealPlan,
  markTripSeen,
} from './reveal-weight';

// ── localStorage mock ─────────────────────────────────────────────────────────

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  });
});

// ── detectRevealMode ──────────────────────────────────────────────────────────

describe('detectRevealMode', () => {
  it('returns fresh for an unseen trip', () => {
    expect(detectRevealMode('Winnipeg', 'Thunder Bay', false)).toBe('fresh');
  });

  it('returns familiar after markTripSeen', () => {
    markTripSeen('Winnipeg', 'Thunder Bay', false);
    expect(detectRevealMode('Winnipeg', 'Thunder Bay', false)).toBe('familiar');
  });

  it('is case-insensitive', () => {
    markTripSeen('winnipeg', 'thunder bay', false);
    expect(detectRevealMode('Winnipeg', 'Thunder Bay', false)).toBe('familiar');
  });

  it('treats round trip and one-way as separate entries', () => {
    markTripSeen('Winnipeg', 'Brandon', false);
    expect(detectRevealMode('Winnipeg', 'Brandon', true)).toBe('fresh');
  });
});

// ── computeRevealPlan ─────────────────────────────────────────────────────────

describe('computeRevealPlan', () => {
  it('familiar — short hold + I know this road copy', () => {
    const plan = computeRevealPlan({ mode: 'familiar' });
    expect(plan.minimumHoldMs).toBe(400);
    expect(plan.steps).toEqual(['I know this road…']);
  });

  it('forked — medium hold + handoff copy', () => {
    const plan = computeRevealPlan({ mode: 'forked' });
    expect(plan.minimumHoldMs).toBe(1200);
    expect(plan.steps).toContain('Taking in your MEE Time…');
    expect(plan.steps).toContain('Making it yours…');
  });

  it('fresh Tier A — 1 driving day', () => {
    const plan = computeRevealPlan({ mode: 'fresh', drivingDays: 1 });
    expect(plan.minimumHoldMs).toBe(600);
    expect(plan.steps).toEqual(['Routing your drive…']);
  });

  it('fresh Tier A — distance <300km (no days)', () => {
    const plan = computeRevealPlan({ mode: 'fresh', distanceKm: 65 });
    expect(plan.minimumHoldMs).toBe(600);
  });

  it('fresh Tier B — 2 driving days', () => {
    const plan = computeRevealPlan({ mode: 'fresh', drivingDays: 2 });
    expect(plan.minimumHoldMs).toBe(1400);
    expect(plan.steps).toEqual(['Mapping the route…', 'Checking the pace…']);
  });

  it('fresh Tier B — 3 driving days', () => {
    const plan = computeRevealPlan({ mode: 'fresh', drivingDays: 3 });
    expect(plan.minimumHoldMs).toBe(1400);
  });

  it('fresh Tier B — 500km no days', () => {
    const plan = computeRevealPlan({ mode: 'fresh', distanceKm: 500 });
    expect(plan.minimumHoldMs).toBe(1400);
  });

  it('fresh Tier C — 4+ driving days', () => {
    const plan = computeRevealPlan({ mode: 'fresh', drivingDays: 5 });
    expect(plan.minimumHoldMs).toBe(2500);
    expect(plan.steps.length).toBe(4);
    // No distanceKm provided — falls back to generic "Mapping the route…"
    expect(plan.steps[0]).toContain('Mapping');
  });

  it('fresh Tier C — 1400km no days', () => {
    const plan = computeRevealPlan({ mode: 'fresh', distanceKm: 1400 });
    expect(plan.minimumHoldMs).toBe(2500);
    expect(plan.steps[0]).toContain('1,400 km');
  });

  it('never exceeds hard cap of 3000ms', () => {
    const plan = computeRevealPlan({ mode: 'fresh', drivingDays: 10, distanceKm: 9999 });
    expect(plan.minimumHoldMs).toBeLessThanOrEqual(3000);
  });

  it('defaults to Tier A when no data provided', () => {
    const plan = computeRevealPlan({ mode: 'fresh' });
    expect(plan.minimumHoldMs).toBe(600);
  });

  it('days take priority over distance for tier', () => {
    // 4 days but only 200km (unlikely, but days should win → Tier C)
    const plan = computeRevealPlan({ mode: 'fresh', drivingDays: 4, distanceKm: 200 });
    expect(plan.minimumHoldMs).toBe(2500);
  });
});

// ── markTripSeen ──────────────────────────────────────────────────────────────

describe('markTripSeen', () => {
  it('persists a trip to localStorage', () => {
    markTripSeen('Winnipeg', 'Kenora', false);
    expect(detectRevealMode('Winnipeg', 'Kenora', false)).toBe('familiar');
  });

  it('does not duplicate existing entries', () => {
    markTripSeen('Winnipeg', 'Kenora', false);
    markTripSeen('Winnipeg', 'Kenora', false);
    const raw = store['mee_seen_trips'];
    const parsed: string[] = JSON.parse(raw);
    expect(parsed.filter(e => e.includes('kenora')).length).toBe(1);
  });

  it('trims to 100 entries max', () => {
    // Seed 100 unique entries
    for (let i = 0; i < 100; i++) {
      markTripSeen('Origin', `Dest${i}`, false);
    }
    // Add one more — should push out the oldest
    markTripSeen('Origin', 'DestNew', false);
    const raw = store['mee_seen_trips'];
    const parsed: string[] = JSON.parse(raw);
    expect(parsed.length).toBe(100);
    expect(detectRevealMode('Origin', 'Dest0', false)).toBe('fresh'); // oldest trimmed
    expect(detectRevealMode('Origin', 'DestNew', false)).toBe('familiar'); // newest kept
  });
});

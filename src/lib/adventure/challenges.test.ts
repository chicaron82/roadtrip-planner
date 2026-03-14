/**
 * challenges.ts — unit tests for challenge helpers.
 *
 * Pure functions — no mocks needed.
 * Covers: getChallenges, getChallengeById, isChallengeReady,
 *         formatParStats, formatHistoricalCost.
 */

import { describe, it, expect } from 'vitest';
import type { TripChallenge } from '../../types';
import {
  getChallenges,
  getChallengeById,
  isChallengeReady,
  formatParStats,
  formatHistoricalCost,
  DIFFICULTY_META,
} from './challenges';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeChallenge(overrides: Partial<TripChallenge> = {}): TripChallenge {
  return {
    id: 'test-challenge',
    title: 'Test Challenge',
    subtitle: 'A → B',
    description: 'A test challenge',
    difficulty: 'cruiser',
    emoji: '🚗',
    year: 2024,
    locations: [
      { id: 'loc-a', name: 'City A', address: 'City A', lat: 49.0, lng: -97.0, type: 'origin' },
      { id: 'loc-b', name: 'City B', address: 'City B', lat: 50.0, lng: -96.0, type: 'destination' },
    ],
    par: {
      totalDistanceKm: 500,
      drivingDays: 2,
      totalDriveHours: 10,
      travelers: 2,
      drivers: 1,
      budget: 300,
      currency: 'CAD',
    },
    settings: {
      isRoundTrip: false,
      numTravelers: 2,
      numDrivers: 1,
      maxDriveHours: 8,
    },
    story: 'A story.',
    tips: ['A tip.'],
    ...overrides,
  };
}

// ─── getChallenges ────────────────────────────────────────────────────────────

describe('getChallenges', () => {
  it('returns an array of challenges', () => {
    expect(getChallenges()).toBeInstanceOf(Array);
    expect(getChallenges().length).toBeGreaterThan(0);
  });

  it('returns challenges sorted easiest first (cruiser before gauntlet)', () => {
    const challenges = getChallenges();
    const difficulties = challenges.map(c => c.difficulty);
    const order = ['cruiser', 'road-warrior', 'iron-driver', 'gauntlet'];
    let lastIdx = -1;
    for (const d of difficulties) {
      const idx = order.indexOf(d);
      expect(idx).toBeGreaterThanOrEqual(lastIdx);
      lastIdx = idx;
    }
  });

  it('does NOT include extended challenges (hidden variants)', () => {
    const ids = getChallenges().map(c => c.id);
    expect(ids).not.toContain('challenge-cet-extended-2025');
  });

  it('includes the Canadian EuroTrip (cruiser)', () => {
    const ids = getChallenges().map(c => c.id);
    expect(ids).toContain('challenge-cet-2025');
  });

  it('includes the Eastern US Gauntlet', () => {
    const ids = getChallenges().map(c => c.id);
    expect(ids).toContain('challenge-eus-2013');
  });

  it('does not mutate the original CHALLENGES array on repeat calls', () => {
    const first = getChallenges().map(c => c.id);
    const second = getChallenges().map(c => c.id);
    expect(first).toEqual(second);
  });
});

// ─── getChallengeById ─────────────────────────────────────────────────────────

describe('getChallengeById', () => {
  it('returns the correct challenge for a known main id', () => {
    const result = getChallengeById('challenge-cet-2025');
    expect(result).toBeDefined();
    expect(result?.title).toBe('The Canadian EuroTrip');
  });

  it('returns the extended challenge (hidden variant) by id', () => {
    const result = getChallengeById('challenge-cet-extended-2025');
    expect(result).toBeDefined();
    expect(result?.id).toBe('challenge-cet-extended-2025');
  });

  it('returns undefined for unknown id', () => {
    expect(getChallengeById('nope-not-a-real-id')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getChallengeById('')).toBeUndefined();
  });
});

// ─── isChallengeReady ─────────────────────────────────────────────────────────

describe('isChallengeReady', () => {
  it('returns true when locations >= 2 and totalDistanceKm > 0', () => {
    expect(isChallengeReady(makeChallenge())).toBe(true);
  });

  it('returns false when locations has only 1 entry', () => {
    const c = makeChallenge({
      locations: [{ id: 'a', name: 'A', address: 'A', lat: 0, lng: 0, type: 'origin' }],
    });
    expect(isChallengeReady(c)).toBe(false);
  });

  it('returns false when locations is empty', () => {
    expect(isChallengeReady(makeChallenge({ locations: [] }))).toBe(false);
  });

  it('returns false when totalDistanceKm is 0', () => {
    const c = makeChallenge({ par: { ...makeChallenge().par, totalDistanceKm: 0 } });
    expect(isChallengeReady(c)).toBe(false);
  });

  it('returns false when both locations < 2 AND totalDistanceKm is 0', () => {
    const c = makeChallenge({ locations: [], par: { ...makeChallenge().par, totalDistanceKm: 0 } });
    expect(isChallengeReady(c)).toBe(false);
  });

  it('real challenges are all ready', () => {
    getChallenges().forEach(c => {
      expect(isChallengeReady(c)).toBe(true);
    });
  });
});

// ─── formatParStats ───────────────────────────────────────────────────────────

describe('formatParStats', () => {
  it('returns a string with km, driving days, and hours', () => {
    const result = formatParStats(makeChallenge());
    expect(result).toMatch(/500/);
    expect(result).toMatch(/km/);
    expect(result).toMatch(/2 driving days/);
    expect(result).toMatch(/~10h/);
  });

  it('uses singular "day" when drivingDays is 1', () => {
    const c = makeChallenge({ par: { ...makeChallenge().par, drivingDays: 1 } });
    expect(formatParStats(c)).toMatch(/1 driving day[^s]/);
  });

  it('returns "Details coming soon" for unready challenge (empty locations)', () => {
    const c = makeChallenge({ locations: [] });
    expect(formatParStats(c)).toBe('Details coming soon');
  });

  it('returns "Details coming soon" for unready challenge (zero distance)', () => {
    const c = makeChallenge({ par: { ...makeChallenge().par, totalDistanceKm: 0 } });
    expect(formatParStats(c)).toBe('Details coming soon');
  });

  it('formats large km with locale separator', () => {
    const c = makeChallenge({ par: { ...makeChallenge().par, totalDistanceKm: 4896 } });
    const result = formatParStats(c);
    // toLocaleString may produce 4,896 or 4 896 depending on locale — just check it's there
    expect(result).toMatch(/4.?896/);
  });
});

// ─── formatHistoricalCost ─────────────────────────────────────────────────────

describe('formatHistoricalCost', () => {
  it('returns a string with budget amount and currency', () => {
    const result = formatHistoricalCost(makeChallenge());
    expect(result).toMatch(/300/);
    expect(result).toMatch(/CAD/);
  });

  it('includes the year', () => {
    const result = formatHistoricalCost(makeChallenge());
    expect(result).toMatch(/2024/);
  });

  it('returns empty string when budget is 0', () => {
    const c = makeChallenge({ par: { ...makeChallenge().par, budget: 0 } });
    expect(formatHistoricalCost(c)).toBe('');
  });

  it('returns empty string when budget is negative', () => {
    const c = makeChallenge({ par: { ...makeChallenge().par, budget: -1 } });
    expect(formatHistoricalCost(c)).toBe('');
  });

  it('uses "?" when year is undefined', () => {
    const c = makeChallenge({ year: undefined });
    expect(formatHistoricalCost(c)).toMatch(/\?/);
  });
});

// ─── DIFFICULTY_META ──────────────────────────────────────────────────────────

describe('DIFFICULTY_META', () => {
  it('has entries for all four difficulty levels', () => {
    expect(DIFFICULTY_META['cruiser']).toBeDefined();
    expect(DIFFICULTY_META['road-warrior']).toBeDefined();
    expect(DIFFICULTY_META['iron-driver']).toBeDefined();
    expect(DIFFICULTY_META['gauntlet']).toBeDefined();
  });

  it('each entry has label, emoji, color, bgColor, borderColor, description', () => {
    for (const meta of Object.values(DIFFICULTY_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.emoji).toBeTruthy();
      expect(meta.color).toBeTruthy();
      expect(meta.bgColor).toBeTruthy();
      expect(meta.borderColor).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
  });
});

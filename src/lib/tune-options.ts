/**
 * tune-options — Contextual one-tap adjustment options for post-reveal Step 3.
 *
 * buildTuneOptions() reads the current settings and summary, then returns
 * only the tune options that make sense. No "upgrade hotels" if already
 * premium; no "push harder" if maxDriveHours is already 10+.
 *
 * Pure function — no React, no side effects.
 */
import type { TripSettings, TripSummary } from '../types';

export interface TuneOption {
  id: string;
  label: string;
  emoji: string;
  /** Partial settings to merge when the user taps this option. */
  patch: Partial<TripSettings>;
}

/** Paired tune options: two opposing adjustments for the same axis. */
export interface TuneOptionPair {
  axis: 'pace' | 'hotels' | 'route';
  options: [TuneOption, TuneOption];
}

export function buildTuneOptions(
  settings: TripSettings,
  _summary: TripSummary,
): TuneOptionPair[] {
  const pairs: TuneOptionPair[] = [];

  // ── Pace axis ──────────────────────────────────────────────────────────────
  const paceOptions: TuneOption[] = [];

  if (settings.maxDriveHours > 5) {
    paceOptions.push({
      id: 'pace-relaxed',
      label: 'More relaxed',
      emoji: '🐢',
      patch: { maxDriveHours: Math.max(5, settings.maxDriveHours - 2) },
    });
  }

  if (settings.maxDriveHours < 10) {
    paceOptions.push({
      id: 'pace-push',
      label: 'Push harder',
      emoji: '🚀',
      patch: { maxDriveHours: Math.min(10, settings.maxDriveHours + 2) },
    });
  }

  if (paceOptions.length === 2) {
    pairs.push({ axis: 'pace', options: [paceOptions[0], paceOptions[1]] });
  }

  // ── Hotels axis ────────────────────────────────────────────────────────────
  const tier = settings.hotelTier ?? 'regular';
  const hotelOptions: TuneOption[] = [];

  if (tier !== 'premium') {
    hotelOptions.push({
      id: 'hotels-upgrade',
      label: 'Upgrade hotels',
      emoji: '✨',
      patch: {
        hotelTier: tier === 'budget' ? 'regular' : 'premium',
        hotelPricePerNight: tier === 'budget' ? 140 : 220,
      },
    });
  }

  if (tier !== 'budget') {
    hotelOptions.push({
      id: 'hotels-save',
      label: 'Save on hotels',
      emoji: '🏕',
      patch: {
        hotelTier: tier === 'premium' ? 'regular' : 'budget',
        hotelPricePerNight: tier === 'premium' ? 140 : 90,
      },
    });
  }

  if (hotelOptions.length === 2) {
    pairs.push({ axis: 'hotels', options: [hotelOptions[0], hotelOptions[1]] });
  }

  // ── Route axis ─────────────────────────────────────────────────────────────
  // Always show both directions — one matches current state, one is the toggle.
  pairs.push({
    axis: 'route',
    options: [
      {
        id: 'route-scenic',
        label: 'More scenic',
        emoji: '🏔️',
        patch: { scenicMode: true, routePreference: 'scenic' as const },
      },
      {
        id: 'route-fastest',
        label: 'Fastest route',
        emoji: '⚡',
        patch: { scenicMode: false, routePreference: 'fastest' as const },
      },
    ],
  });

  return pairs;
}

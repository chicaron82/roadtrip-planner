/**
 * VoilaScreen — smoke + interaction tests
 *
 * Focus: mounts without crashing, key UI landmarks visible,
 * callbacks wired correctly. Not exhaustive — Voila is presentation-heavy.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoilaScreen } from './VoilaScreen';
import { makeSummary, makeSettings, makeLocation } from '../../test/fixtures';
import type { Location } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLocations(): Location[] {
  return [
    { ...makeLocation('Winnipeg'), type: 'origin' },
    { ...makeLocation('Thunder Bay'), type: 'destination' },
  ];
}

function renderScreen(overrides: Record<string, unknown> = {}) {
  const onEditTrip = vi.fn();
  const onLockIn = vi.fn();
  const onShare = vi.fn();

  const utils = render(
    <VoilaScreen
      summary={makeSummary({ gasStops: 0, drivingDays: 3, fullGeometry: [] })}
      settings={makeSettings({ currency: 'CAD', numTravelers: 2 })}
      locations={makeLocations()}
      onEditTrip={onEditTrip}
      onLockIn={onLockIn}
      onShare={onShare}
      {...overrides}
    />,
  );

  return { ...utils, onEditTrip, onLockIn, onShare };
}

// ── Smoke test ────────────────────────────────────────────────────────────────

describe('VoilaScreen', () => {
  it('mounts without crashing', () => {
    expect(() => renderScreen()).not.toThrow();
  });

  // ── Header ────────────────────────────────────────────────────────────────

  describe('header', () => {
    it('shows the Edit Trip button', () => {
      renderScreen();
      // Two "Edit Trip" buttons exist (header + bottom bar) — confirm at least one
      expect(screen.getAllByText('Edit Trip').length).toBeGreaterThanOrEqual(1);
    });

    it('shows the Share button', () => {
      renderScreen();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('shows the route label from origin → destination', () => {
      renderScreen();
      // Route label renders in both the header bar and VoilaHero — both correct
      expect(screen.getAllByText('Winnipeg → Thunder Bay').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Bottom CTA bar ────────────────────────────────────────────────────────

  describe('bottom CTA bar', () => {
    it('shows "Let MEE make it better" button', () => {
      renderScreen();
      expect(screen.getByText('Let MEE make it better')).toBeInTheDocument();
    });

    it('shows "Lock it in →" button', () => {
      renderScreen();
      expect(screen.getByText('Lock it in →')).toBeInTheDocument();
    });
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('calls onEditTrip when the header Edit Trip button is clicked', () => {
      const { onEditTrip } = renderScreen();
      fireEvent.click(screen.getAllByText('Edit Trip')[0]);
      expect(onEditTrip).toHaveBeenCalledTimes(1);
    });

    it('calls onShare when Share is clicked', () => {
      const { onShare } = renderScreen();
      fireEvent.click(screen.getByText('Share'));
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it('does not immediately call onLockIn when "Lock it in" is clicked (VoilaLockIn overlay mediates)', () => {
      const { onLockIn } = renderScreen();
      fireEvent.click(screen.getByText('Lock it in →'));
      // onLockIn fires after the 800ms VoilaLockIn animation — not immediately
      expect(onLockIn).not.toHaveBeenCalled();
    });
  });

  // ── Custom title ──────────────────────────────────────────────────────────

  describe('title', () => {
    it('uses customTitle when provided', () => {
      renderScreen({ customTitle: 'My Weekend Escape' });
      expect(screen.getByText('My Weekend Escape')).toBeInTheDocument();
    });

    it('falls back to seeded title when customTitle is null', () => {
      // Just verify something renders in the h1 — seeded title is deterministic
      renderScreen({ customTitle: null });
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.textContent?.trim().length).toBeGreaterThan(0);
    });
  });
});

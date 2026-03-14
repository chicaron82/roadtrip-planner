/**
 * TripSummary.test.tsx
 *
 * Tests the summary card including:
 * - Stat rendering (Distance, time, etc.)
 * - Auto-expansion logic on feasibility change (change-driven)
 * - Refinement warnings logic (setState during render)
 * - Expansion/Collapse toggle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { TripSummaryCard } from './TripSummary';
import { makeSummary, makeSettings } from '../../test/fixtures';
import { analyzeFeasibility, compareRefinements } from '../../lib/feasibility';
import type { FeasibilityResult, FeasibilityWarning } from '../../lib/feasibility';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../lib/feasibility', () => ({
  analyzeFeasibility: vi.fn(),
  compareRefinements: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUMMARY = makeSummary({ totalDistanceKm: 1000, totalDurationMinutes: 600 });
const SETTINGS = makeSettings({ numTravelers: 2, numDrivers: 1 });

describe('TripSummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyzeFeasibility).mockImplementation(() => ({
      status: 'on-track',
      warnings: [],
      summary: { budgetUtilization: 0.5, totalBudgetUsed: 100, totalBudgetAvailable: 200, longestDriveDay: 300, maxDriveLimit: 600, totalDays: 2, perPersonCost: 50 },
    } as FeasibilityResult));
  });

  async function expandEverything() {
    // 1. Expand Card if minimized
    const expandBtn = screen.queryByTitle('Expand');
    if (expandBtn) fireEvent.click(expandBtn);
    
    // 2. Expand Banner if collapsed (Banner is inside the card, so we wait a bit or use findBy)
    const bannerStatus = await screen.findByRole('status');
    const bannerToggle = bannerStatus.querySelector('button');
    if (bannerToggle && bannerToggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(bannerToggle);
    }
  }

  it('renders stats and toggles expansion', () => {
    const { getByText, getByTitle, queryByTitle } = render(<TripSummaryCard summary={SUMMARY} settings={SETTINGS} tripActive={false} />);
    expect(getByText(/Distance/i)).toBeTruthy();
    fireEvent.click(getByTitle('Expand'));
    expect(queryByTitle('Minimize')).toBeTruthy();
  });

  it('generates refinement warnings when travelers change', async () => {
    const { rerender } = render(<TripSummaryCard summary={SUMMARY} settings={SETTINGS} tripActive={false} />);

    vi.mocked(compareRefinements).mockReturnValue([{
      category: 'passenger',
      severity: 'info',
      message: 'RefinementMsg123',
    } as FeasibilityWarning]);

    rerender(<TripSummaryCard summary={SUMMARY} settings={{ ...SETTINGS, numTravelers: 3 }} tripActive={false} />);
    await waitFor(() => expect(compareRefinements).toHaveBeenCalled());

    await expandEverything();

    expect(await screen.findByText(/RefinementMsg123/i)).toBeTruthy();
  });

  it('clears refinement warnings when summary changes', async () => {
    const { rerender } = render(<TripSummaryCard summary={SUMMARY} settings={SETTINGS} tripActive={false} />);

    vi.mocked(compareRefinements).mockReturnValue([{
      category: 'passenger',
      severity: 'info',
      message: 'PersistentR1',
    } as FeasibilityWarning]);

    rerender(<TripSummaryCard summary={SUMMARY} settings={{ ...SETTINGS, numTravelers: 4 }} tripActive={false} />);
    await waitFor(() => expect(compareRefinements).toHaveBeenCalled());

    await expandEverything();
    expect(await screen.findByText(/PersistentR1/i)).toBeTruthy();

    // Change summary
    rerender(<TripSummaryCard summary={{ ...SUMMARY, totalDistanceKm: 5050 }} settings={{ ...SETTINGS, numTravelers: 4 }} tripActive={false} />);

    await waitFor(() => {
      expect(screen.queryByText(/PersistentR1/i)).toBeNull();
    });
  });

  it('auto-expands when feasibility changes to non-green', async () => {
    const { rerender, findByTitle } = render(<TripSummaryCard summary={SUMMARY} settings={SETTINGS} tripActive={false} />);
    
    vi.mocked(analyzeFeasibility).mockReturnValue({
      status: 'tight',
      warnings: [{ category: 'drive-time', severity: 'warning', message: 'Tight' }],
      summary: { budgetUtilization: 0.8, totalBudgetUsed: 800, totalBudgetAvailable: 1000, longestDriveDay: 500, maxDriveLimit: 600, totalDays: 2, perPersonCost: 400 }
    } as FeasibilityResult);

    rerender(<TripSummaryCard summary={SUMMARY} settings={{ ...SETTINGS, stopFrequency: 'balanced' }} tripActive={false} />);
    expect(await findByTitle('Minimize')).toBeTruthy();
  });
});

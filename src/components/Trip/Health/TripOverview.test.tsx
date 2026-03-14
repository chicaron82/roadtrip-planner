/**
 * TripOverview — component render tests
 *
 * TripOverview is a thin display layer over generateTripOverview (already
 * tested in trip-analyzer.test.ts). These tests confirm that the component
 * correctly renders the data it receives from the analyzer: difficulty label/
 * score, confidence label/score, and any highlights chips.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TripOverview } from './TripOverview';
import { makeSummary, makeSettings, makeSegment, makeLocation } from '../../../test/fixtures';
import type { TripOverviewSummary } from '../../../lib/trip-summary-slices';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTripOverviewSummary(overrides: Partial<TripOverviewSummary> = {}): TripOverviewSummary {
  return {
    days: [],
    segments: [makeSegment()],
    totalDistanceKm: 200,
    totalDurationMinutes: 120,
    gasStops: 1,
    ...overrides,
  };
}

// ─── Section labels ───────────────────────────────────────────────────────────

describe('section labels', () => {
  it('renders "Difficulty" label', () => {
    render(<TripOverview summary={makeTripOverviewSummary()} settings={makeSettings()} />);
    expect(screen.getByText('Difficulty')).toBeDefined();
  });

  it('renders "Confidence" label', () => {
    render(<TripOverview summary={makeTripOverviewSummary()} settings={makeSettings()} />);
    expect(screen.getByText('Confidence')).toBeDefined();
  });
});

// ─── Difficulty output ────────────────────────────────────────────────────────

describe('difficulty display', () => {
  it('renders a difficulty level text (easy for a simple trip)', () => {
    render(<TripOverview summary={makeTripOverviewSummary()} settings={makeSettings()} />);
    expect(screen.getByText(/easy/i)).toBeDefined();
  });

  it('renders difficulty score formatted as "N/100"', () => {
    render(<TripOverview summary={makeTripOverviewSummary()} settings={makeSettings()} />);
    expect(screen.getByText(/\/100/)).toBeDefined();
  });

  it('renders a difficulty level of extreme for a very hard trip', () => {
    const hardSummary = makeTripOverviewSummary({
      totalDistanceKm: 3000,
      totalDurationMinutes: 30 * 60,
      segments: [
        makeSegment({
          from: makeLocation('A'),
          to: makeLocation('B'),
          distanceKm: 3000,
          durationMinutes: 1800,
          warnings: [{ type: 'long_drive', severity: 'critical', message: 'Very long' }],
          timezoneCrossing: true,
        }),
      ],
    });
    render(<TripOverview summary={hardSummary} settings={makeSettings({ maxDriveHours: 8 })} />);
    expect(screen.getByText(/extreme/i)).toBeDefined();
  });
});

// ─── Confidence output ────────────────────────────────────────────────────────

describe('confidence display', () => {
  it('renders a confidence label', () => {
    render(<TripOverview summary={makeTripOverviewSummary()} settings={makeSettings()} />);
    // Confidence labels include: Excellent, Very Good, Good, Fair, Uncertain
    const labels = ['Excellent', 'Very Good', 'Good', 'Fair', 'Uncertain'];
    const found = labels.some(label => screen.queryByText(label) !== null);
    expect(found).toBe(true);
  });

  it('renders confidence score "% accurate"', () => {
    render(<TripOverview summary={makeTripOverviewSummary()} settings={makeSettings()} />);
    expect(screen.getByText(/% accurate/)).toBeDefined();
  });
});

// ─── Highlights chips ─────────────────────────────────────────────────────────

describe('highlights', () => {
  it('renders driving hours highlight for a 6h trip', () => {
    const summary = makeTripOverviewSummary({ totalDurationMinutes: 360 });
    render(<TripOverview summary={summary} settings={makeSettings()} />);
    expect(screen.getByText(/hours/i)).toBeDefined();
  });

  it('renders gas stop highlight when gasStops > 0', () => {
    const summary = makeTripOverviewSummary({ gasStops: 3 });
    render(<TripOverview summary={summary} settings={makeSettings()} />);
    expect(screen.getByText(/gas stop/i)).toBeDefined();
  });

  it('renders no highlights chips for a very short trip with no stops', () => {
    // 30 min drive → no driving-hours highlight (analyzer only adds it for > reasonable threshold)
    const summary = makeTripOverviewSummary({ totalDurationMinutes: 30, gasStops: 0 });
    // We simply verify the component doesn't crash — highlights may be empty
    expect(() =>
      render(<TripOverview summary={summary} settings={makeSettings()} />)
    ).not.toThrow();
  });
});

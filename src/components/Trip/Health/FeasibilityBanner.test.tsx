/**
 * FeasibilityBanner — component render tests
 *
 * Covers display branches that live outside pure-function test scope:
 * - Status label / icon selection (on-track / tight / over)
 * - Warning count badge
 * - Expand / collapse toggle
 * - Warning message rendering
 * - Severity badge text
 * - Dismiss button removes a warning from the visible list
 * - All-dismissed "acknowledged" state
 * - Budget chip (per-person vs solo)
 * - Pulsing attention ring when collapsed with warnings
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeasibilityBanner } from './FeasibilityBanner';
import type { FeasibilityResult } from '../../../lib/feasibility';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<FeasibilityResult> = {}): FeasibilityResult {
  return {
    status: 'on-track',
    warnings: [],
    summary: {
      budgetUtilization: 0,
      totalBudgetUsed: 0,
      totalBudgetAvailable: 1000,
      longestDriveDay: 300,
      maxDriveLimit: 480,
      totalDays: 1,
      perPersonCost: 0,
    },
    ...overrides,
  };
}

function makeWarning(overrides: Partial<FeasibilityResult['warnings'][0]> = {}): FeasibilityResult['warnings'][0] {
  return {
    category: 'budget',
    severity: 'warning',
    message: 'Test warning message',
    suggestion: 'Try reducing hotel costs',
    ...overrides,
  };
}

// ─── Status label tests ────────────────────────────────────────────────────────

describe('status label', () => {
  it('renders "On Track" for on-track status', () => {
    render(<FeasibilityBanner result={makeResult({ status: 'on-track' })} />);
    expect(screen.getByText('On Track')).toBeDefined();
  });

  it('renders "Getting Tight" for tight status', () => {
    render(<FeasibilityBanner result={makeResult({ status: 'tight' })} />);
    expect(screen.getByText('Getting Tight')).toBeDefined();
  });

  it('renders "Check the Route" for over status', () => {
    render(<FeasibilityBanner result={makeResult({ status: 'over' })} />);
    expect(screen.getByText('Check the Route')).toBeDefined();
  });
});

// ─── aria-label ───────────────────────────────────────────────────────────────

describe('aria-label', () => {
  it('reflects the status in the aria-label', () => {
    render(<FeasibilityBanner result={makeResult({ status: 'tight' })} />);
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-label')).toContain('Getting Tight');
  });
});

// ─── Warning count badge ───────────────────────────────────────────────────────

describe('warning count badge', () => {
  it('shows no badge when there are no warnings', () => {
    render(<FeasibilityBanner result={makeResult()} />);
    expect(screen.queryByText(/note/)).toBeNull();
  });

  it('shows "1 note" singular for a single warning', () => {
    const result = makeResult({ warnings: [makeWarning()] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText(/1 note/)).toBeDefined();
  });

  it('shows "N notes" plural for multiple warnings', () => {
    const result = makeResult({
      warnings: [makeWarning(), makeWarning({ message: 'Second warning' })],
    });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText(/2 notes/)).toBeDefined();
  });
});

// ─── Expand / collapse ────────────────────────────────────────────────────────

describe('expand / collapse', () => {
  it('starts expanded by default', () => {
    const result = makeResult({ warnings: [makeWarning()] });
    render(<FeasibilityBanner result={result} />);
    // Warning text is visible when expanded
    expect(screen.getByText('Test warning message')).toBeDefined();
  });

  it('starts collapsed when defaultCollapsed=true', () => {
    const result = makeResult({ warnings: [makeWarning()] });
    render(<FeasibilityBanner result={result} defaultCollapsed />);
    // Warning text should be hidden
    expect(screen.queryByText('Test warning message')).toBeNull();
  });

  it('toggles to collapsed when header is clicked', () => {
    const result = makeResult({ warnings: [makeWarning()] });
    render(<FeasibilityBanner result={result} />);
    // Warning visible initially
    expect(screen.getByText('Test warning message')).toBeDefined();

    // The toggle button has aria-expanded="true" when expanded
    const button = screen.getByRole('button', { expanded: true });
    fireEvent.click(button);

    // Warning hidden after collapse
    expect(screen.queryByText('Test warning message')).toBeNull();
  });

  it('toggles back to expanded on second click', () => {
    const result = makeResult({ warnings: [makeWarning()] });
    render(<FeasibilityBanner result={result} defaultCollapsed />);

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button); // expand
    expect(screen.getByText('Test warning message')).toBeDefined();

    const toggleBtn = screen.getByRole('button', { expanded: true });
    fireEvent.click(toggleBtn); // collapse
    expect(screen.queryByText('Test warning message')).toBeNull();
  });
});

// ─── All-clear message ────────────────────────────────────────────────────────

describe('all-clear message', () => {
  it('shows all-clear text when expanded with no warnings', () => {
    render(<FeasibilityBanner result={makeResult({ status: 'on-track' })} />);
    expect(screen.getByText(/All green/i)).toBeDefined();
  });

  it('does not show all-clear text when collapsed', () => {
    render(<FeasibilityBanner result={makeResult({ status: 'on-track' })} defaultCollapsed />);
    expect(screen.queryByText(/All green/i)).toBeNull();
  });
});

// ─── Warning row rendering ────────────────────────────────────────────────────

describe('warning row rendering', () => {
  it('renders the warning message text', () => {
    const result = makeResult({ warnings: [makeWarning({ message: 'Drive time too long' })] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText('Drive time too long')).toBeDefined();
  });

  it('renders the suggestion text', () => {
    const result = makeResult({ warnings: [makeWarning({ suggestion: 'Consider splitting the drive' })] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText('Consider splitting the drive')).toBeDefined();
  });

  it('renders the day number when present', () => {
    const result = makeResult({ warnings: [makeWarning({ dayNumber: 2 })] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText('Day 2')).toBeDefined();
  });

  it('renders the severity badge', () => {
    const result = makeResult({ warnings: [makeWarning({ severity: 'critical' })] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText('critical')).toBeDefined();
  });

  it('renders "info" severity badge text', () => {
    const result = makeResult({ warnings: [makeWarning({ severity: 'info' })] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText('info')).toBeDefined();
  });

  it('renders "warning" severity badge text', () => {
    const result = makeResult({ warnings: [makeWarning({ severity: 'warning' })] });
    render(<FeasibilityBanner result={result} />);
    expect(screen.getByText('warning')).toBeDefined();
  });
});

// ─── Dismiss behaviour ────────────────────────────────────────────────────────

describe('dismiss behaviour', () => {
  it('removes a dismissed warning from the visible list', () => {
    const result = makeResult({ warnings: [makeWarning({ message: 'Budget tight' })] });
    render(<FeasibilityBanner result={result} />);

    expect(screen.getByText('Budget tight')).toBeDefined();

    const dismissBtn = screen.getByLabelText('Acknowledge warning');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Budget tight')).toBeNull();
  });

  it('shows "All notes acknowledged" when all warnings are dismissed', () => {
    const result = makeResult({ warnings: [makeWarning({ message: 'Some warning' })] });
    render(<FeasibilityBanner result={result} />);

    const dismissBtn = screen.getByLabelText('Acknowledge warning');
    fireEvent.click(dismissBtn);

    expect(screen.getByText(/All notes acknowledged/i)).toBeDefined();
  });

  it('shows dismissed count in the badge after dismissing one of two', () => {
    const result = makeResult({
      warnings: [
        makeWarning({ message: 'Warning A', category: 'budget' }),
        makeWarning({ message: 'Warning B', category: 'drive-time' }),
      ],
    });
    render(<FeasibilityBanner result={result} />);

    const dismissBtns = screen.getAllByLabelText('Acknowledge warning');
    fireEvent.click(dismissBtns[0]); // dismiss first

    // Badge should show "(1 ✓)"
    expect(screen.getByText(/1 ✓/)).toBeDefined();
  });
});

// ─── Budget chip ──────────────────────────────────────────────────────────────

describe('budget chip', () => {
  const resultWithBudget = makeResult({
    summary: {
      budgetUtilization: 0.6,
      totalBudgetUsed: 600,
      totalBudgetAvailable: 1000,
      longestDriveDay: 300,
      maxDriveLimit: 480,
      totalDays: 2,
      perPersonCost: 200,
    },
  });

  it('shows per-person cost for groups (numTravelers > 1)', () => {
    render(<FeasibilityBanner result={resultWithBudget} numTravelers={3} />);
    expect(screen.getByText(/\$200\/person/)).toBeDefined();
  });

  it('does not show per-person for solo traveler', () => {
    render(<FeasibilityBanner result={resultWithBudget} numTravelers={1} />);
    expect(screen.queryByText(/\/person/)).toBeNull();
  });

  it('hides chip when budgetUtilization is 0', () => {
    render(<FeasibilityBanner result={makeResult()} numTravelers={3} />);
    expect(screen.queryByText(/\/person/)).toBeNull();
    expect(screen.queryByText(/% budget/)).toBeNull();
  });
});

// ─── Pulsing attention ring ───────────────────────────────────────────────────

describe('attention ring', () => {
  it('is absent when the banner is expanded', () => {
    const result = makeResult({ status: 'tight', warnings: [makeWarning()] });
    const { container } = render(<FeasibilityBanner result={result} />);
    // Ring div has animate-pulse + ring-* classes — should not be present when expanded
    const ring = container.querySelector('.ring-amber-400\\/70, .ring-red-400\\/70');
    expect(ring).toBeNull();
  });

  it('is present when collapsed with non-green status and warnings', () => {
    const result = makeResult({ status: 'tight', warnings: [makeWarning()] });
    const { container } = render(<FeasibilityBanner result={result} defaultCollapsed />);
    const ring = container.querySelector('[class*="ring-amber-400"]');
    expect(ring).not.toBeNull();
  });

  it('is absent for on-track status even when collapsed', () => {
    const result = makeResult({ status: 'on-track', warnings: [] });
    const { container } = render(<FeasibilityBanner result={result} defaultCollapsed />);
    const ring = container.querySelector('[class*="ring-amber-400"], [class*="ring-red-400"]');
    expect(ring).toBeNull();
  });
});

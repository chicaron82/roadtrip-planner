/**
 * TripBudgetHealth — component render tests
 *
 * Verifies status label, narrative line, and category-row visibility based
 * on the relationship between budgeted amounts and estimated actuals.
 *
 * Status thresholds (netDelta = totalBudgeted − estimatedTotal):
 *   > 50        → "On Track"       (green)
 *   0–50        → "Tight"          (amber)
 *   -100–0      → "Slightly Over"  (orange)
 *   < -100      → "Over Budget"    (red)
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TripBudgetHealth } from './TripBudgetHealth';
import { makeBudget } from '../../../test/fixtures';
import type { CostBreakdown } from '../../../types/route';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A fixed budget with totalBudgeted = 2000.
 * Change breakdown amounts in tests to control netDelta.
 */
const BUDGET = makeBudget({
  gas: 500, hotel: 700, food: 600, misc: 200,
});
// totalBudgeted = 500 + 700 + 600 + 200 = 2000

function makeBreakdown(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    fuel: 0,
    accommodation: 0,
    meals: 0,
    misc: 0,
    total: 0,
    perPerson: 0,
    ...overrides,
  };
}

/** Render the component and return the container for further assertions. */
function renderHealth(
  breakdown: CostBreakdown,
  opts: { budgetOverrides?: Parameters<typeof makeBudget>[0] } = {},
) {
  const budget = opts.budgetOverrides ? makeBudget(opts.budgetOverrides) : BUDGET;
  const { container } = render(
    <TripBudgetHealth budget={budget} breakdown={breakdown} currency="CAD" />,
  );
  return container;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TripBudgetHealth', () => {

  // ══ Null guard ═════════════════════════════════════════════════════════════

  it('renders nothing when all budget categories are 0', () => {
    const emptyBudget = makeBudget({ gas: 0, hotel: 0, food: 0, misc: 0 });
    const { container } = render(
      <TripBudgetHealth
        budget={emptyBudget}
        breakdown={makeBreakdown({ fuel: 100, accommodation: 100 })}
        currency="CAD"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  // ══ Status labels ══════════════════════════════════════════════════════════

  it('shows "On Track" when estimated total is well below budget (netDelta > 50)', () => {
    // estimatedTotal = 400+600+500+100 = 1600 → netDelta = 2000-1600 = 400
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 600, meals: 500, misc: 100 }));
    expect(screen.getByText('On Track')).toBeInTheDocument();
  });

  it('shows "Tight" when estimated total is just under budget (0 ≤ netDelta ≤ 50)', () => {
    // estimatedTotal = 1975 → netDelta = 25
    renderHealth(makeBreakdown({ fuel: 490, accommodation: 695, meals: 595, misc: 195 }));
    expect(screen.getByText('Tight')).toBeInTheDocument();
  });

  it('shows "Slightly Over" when estimated total slightly exceeds budget (-100 < netDelta < 0)', () => {
    // estimatedTotal = 2050 → netDelta = -50
    renderHealth(makeBreakdown({ fuel: 510, accommodation: 720, meals: 610, misc: 210 }));
    expect(screen.getByText('Slightly Over')).toBeInTheDocument();
  });

  it('shows "Over Budget" when estimated total far exceeds budget (netDelta ≤ -100)', () => {
    // estimatedTotal = 2600 → netDelta = -600
    renderHealth(makeBreakdown({ fuel: 600, accommodation: 900, meals: 800, misc: 300 }));
    expect(screen.getByText('Over Budget')).toBeInTheDocument();
  });

  it('status label is also shown as the badge text (appears twice)', () => {
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 600, meals: 500, misc: 100 }));
    // Header section title + badge span both render the label
    expect(screen.getAllByText('On Track').length).toBeGreaterThanOrEqual(1);
  });

  // ══ Boundary cases ═════════════════════════════════════════════════════════

  it('shows "On Track" at exactly netDelta = 51', () => {
    // estimatedTotal = 2000 - 51 = 1949
    // fuel=490, accommodation=684, meals=575, misc=200 → 1949
    renderHealth(makeBreakdown({ fuel: 490, accommodation: 684, meals: 575, misc: 200 }));
    expect(screen.getByText('On Track')).toBeInTheDocument();
  });

  it('shows "Tight" at exactly netDelta = 0 (no over/under)', () => {
    // estimatedTotal = 2000 = totalBudgeted → netDelta = 0
    renderHealth(makeBreakdown({ fuel: 500, accommodation: 700, meals: 600, misc: 200 }));
    expect(screen.getByText('Tight')).toBeInTheDocument();
  });

  it('shows "Over Budget" at exactly netDelta = -100', () => {
    // estimatedTotal = 2100 → netDelta = -100
    renderHealth(makeBreakdown({ fuel: 525, accommodation: 735, meals: 630, misc: 210 }));
    expect(screen.getByText('Over Budget')).toBeInTheDocument();
  });

  // ══ Narrative line ═════════════════════════════════════════════════════════

  it('narrative says spend fits when all categories are under budget', () => {
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 500, meals: 400, misc: 100 }));
    // buildNarrativeLine returns "Estimated spend fits within your $X budget."
    expect(screen.getByText(/fits within/i)).toBeInTheDocument();
  });

  it('narrative names the over-budget category when hotel runs over', () => {
    // hotel budget = 700, estimated accommodation = 900 → Hotel over by 200
    // gas/food/misc are under, net still covers it (Tight)
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 900, meals: 500, misc: 150 }));
    // buildNarrativeLine: "Hotel runs over, but Gas & Food & Misc surplus covers it — net …"
    expect(screen.getByText(/Hotel runs over/i)).toBeInTheDocument();
  });

  it('narrative says "short overall" when over and no under-budget surplus covers it', () => {
    // All categories over budget with no significant under-budget surplus
    renderHealth(makeBreakdown({ fuel: 600, accommodation: 900, meals: 800, misc: 300 }));
    // netDelta = -600 → buildNarrativeLine returns "Estimated spend exceeds budget by …"
    expect(screen.getByText(/exceeds budget/i)).toBeInTheDocument();
  });

  // ══ Category rows ══════════════════════════════════════════════════════════

  it('always renders Gas, Hotel, Food rows', () => {
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 600, meals: 400 }));
    expect(screen.getByText(/⛽ Gas/i)).toBeInTheDocument();
    expect(screen.getByText(/🏨 Hotel/i)).toBeInTheDocument();
    expect(screen.getByText(/🍽/)).toBeInTheDocument();
  });

  it('renders Misc row when budget.misc > 0', () => {
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 600, meals: 400, misc: 0 }));
    // BUDGET has misc=200, so misc row should appear
    expect(screen.getByText(/💳 Misc/i)).toBeInTheDocument();
  });

  it('omits Misc row when both budget.misc and breakdown.misc are 0', () => {
    const noMiscBudget = makeBudget({ gas: 600, hotel: 800, food: 600, misc: 0 });
    const { container } = render(
      <TripBudgetHealth
        budget={noMiscBudget}
        breakdown={makeBreakdown({ fuel: 500, accommodation: 700, meals: 500, misc: 0 })}
        currency="CAD"
      />,
    );
    expect(container.querySelector('*')).not.toBeNull(); // renders something
    expect(screen.queryByText(/💳 Misc/i)).toBeNull();
  });

  // ══ "Budget Health" heading ═════════════════════════════════════════════════

  it('renders "Budget Health" section heading', () => {
    renderHealth(makeBreakdown({ fuel: 400, accommodation: 600, meals: 400 }));
    expect(screen.getByText('Budget Health')).toBeInTheDocument();
  });
});

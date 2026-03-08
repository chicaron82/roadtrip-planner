# `budget/` — Budget Calculation Pipeline

Splits a trip into driving days, assigns costs to each day, and produces the final `TripDay[]` + `CostBreakdown`.

---

## Pipeline

```
split-by-days.ts
  │  Entry point. Takes ProcessedSegment[] from segment-processor.ts.
  │  Walks segments, detects day boundaries, assigns overnight stops.
  │  Produces TripDay[] with per-day budgets.
  │
  ├─ segment-processor.ts    ← Pre-processing step. Splits any single segment
  │                             longer than maxDriveMinutes into proportional
  │                             sub-segments. Maps _originalIndex for round-trip
  │                             midpoint detection downstream.
  │
  ├─ day-builder.ts          ← Per-day cost assembly. Given a set of segments
  │                             and stops for one day, calculates:
  │                             fuel cost (dual-source model), hotel cost,
  │                             meal estimates, misc spending.
  │
  ├─ calculator.ts           ← Pure math helpers:
  │                             applyBudgetWeights(), getPerPersonCost(),
  │                             budget category splits.
  │
  ├─ defaults.ts             ← COST_ESTIMATES and BUDGET_PROFILES constants.
  │                             Frugal / Balanced / Comfort preset definitions.
  │
  ├─ summary.ts              ← calculateCostBreakdown() — rolls up TripDay[]
  │                             into final CostBreakdown with rounding.
  │
  ├─ timezone.ts             ← Timezone helpers specific to day-splitting:
  │                             handles clock advancement across timezone
  │                             transitions between driving days.
  │
  └─ index.ts                ← Public re-export barrel.
```

---

## Dual-Source Fuel Model

The fuel calculation uses two sources reconciled per day:

1. **Strategic fuel stops (primary)** — actual at-the-pump cost per fill-up, calculated from tank size, L/100km, and gas price. This is what you'd actually pay at each stop.
2. **Per-km math (fallback)** — used only for the stretch after the last strategic stop to the final destination (the "home stretch" where no fill-up is planned).

`day-builder.ts` owns this logic. The final `totalFuelCost` in the summary comes from `calculateCostBreakdown()` (sum of reconciled daily costs), not from the per-km model.

> This matters: the ~$57 Winnipeg→Vancouver discrepancy that existed before this model was introduced came from applying per-km fuel math to the entire route instead of stop-based math.

---

## Key Files

### `split-by-days.ts`
The core day-splitting loop. The most complex file in the pipeline (~258 lines). Owns:
- Walking `ProcessedSegment[]` and detecting day boundaries (when cumulative drive time hits `maxDriveHours`)
- Inserting free days at midpoints (e.g. planned rest days on long trips)
- Tracking timezone transitions across day boundaries
- Calling `day-builder.ts` to assemble each day's budget

> ⚠️ **Tech debt:** This file is over the 300-line limit. The `insertFreeDaysAtMidpoint` block (~100 lines) is a candidate for extraction but deferred due to complex mutable state threading.

### `segment-processor.ts`
Stateless pre-processing. `splitLongSegments()` ensures no single segment exceeds `maxDriveMinutes` by splitting it into proportional sub-segments. Each sub-segment carries `_originalIndex` so round-trip midpoint detection works correctly downstream.

### `day-builder.ts`
Builds a single `TripDay` from its segments. Owns the dual-source fuel model, hotel cost lookup (from `regional-costs.ts`), meal estimates, and misc allocation. Also exports `ceilToNearest()` utility used by `summary.ts`.

### `calculator.ts`
Pure math. No state, no side effects. `applyBudgetWeights()` splits a total budget amount into category amounts based on BUDGET_PROFILES percentage weights.

### `defaults.ts`
Single source of truth for cost constants and profile definitions. If gas prices or hotel estimates need updating, this is the only file to change.

### `summary.ts`
`calculateCostBreakdown()` — final rollup. Sums fuel, accommodation, meals, and misc from all `TripDay[]` budgets, rounds to nearest $5/$10.

### `timezone.ts`
Timezone clock helpers for day-splitting. Separate from `../trip-timezone.ts` which handles route-level timezone detection — this file handles the clock advancement *between* days.

---

## Rules

- The pipeline is **one-directional.** `segment-processor.ts` → `split-by-days.ts` → `day-builder.ts` → `summary.ts`. No back-references.
- `defaults.ts` and `calculator.ts` are **imported by** the pipeline; they don't import from it.
- No API calls anywhere in this pipeline. All inputs are pre-computed before the budget pipeline runs.

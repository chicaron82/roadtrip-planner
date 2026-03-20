# Kitchen Ticket — Mar 19, 2026
## Print: Open Mode Budget Display + Estimate Mode CTA

**Source:** Aaron bug report — PDF showing "Over by $630" when no budget was set
**Files:** `src/lib/trip-print-cover.ts`, `src/lib/trip-print-day.ts`, `src/lib/trip-print-styles.ts`
**Confidence:** High — contained changes, no architecture impact

---

## The Problem

When a user prints a trip in open mode (no budget set), the PDF shows:

```
Trip budget after Day 1: Over by $265.00
Trip budget after Day 2: Over by $455.00
Trip budget after Day 3: Over by $630.00
```

This is a nonsense comparison. There was no budget. They're not "over" anything. They spent $630. That's just what the trip cost.

The root cause: `budget.bankRemaining` in open mode is initialized to $0 (no budget), so every dollar spent registers as "over."

---

## The Fix — Three Parts

---

### Part 1 — `trip-print-day.ts` — Remove open-mode "over by" language

**File:** `src/lib/trip-print-day.ts`

**Function:** `buildBudgetHTML(day, tripBudgetRemaining)`

`tripBudgetRemaining` is already `undefined` when `budgetMode !== 'plan-to-budget'` (see `trip-print-builders.ts` line 226-228). The function correctly gates on this — but then falls through to `budget.bankRemaining` which compares against $0.

**Current code (lines 381-410):**
```ts
function buildBudgetHTML(day: TripDay, tripBudgetRemaining?: number): string {
  const budget = day.budget;
  const tripBudgetHTML = tripBudgetRemaining === undefined
    ? ''
    : `...`;

  return `
    <div class=\"budget-row\">
      ...
      ${tripBudgetRemaining === undefined ? `
      <br />
      📊 <strong>Trip budget after Day ${day.dayNumber}:</strong>
      ${budget.bankRemaining < 0 ? `Over by ${formatCurrency(Math.abs(budget.bankRemaining))}` : `${formatCurrency(budget.bankRemaining)} remaining`}
      ` : ''}
    </div>
  `;
}
```

**Replace the entire `buildBudgetHTML` function with:**
```ts
function buildBudgetHTML(day: TripDay, tripBudgetRemaining?: number): string {
  const budget = day.budget;

  // Only show budget tracking when user actually set a budget.
  // tripBudgetRemaining is undefined in open mode — don't compare against $0.
  const tripBudgetHTML = tripBudgetRemaining === undefined
    ? ''  // open mode — no tracker
    : tripBudgetRemaining < 0
      ? `&nbsp;|&nbsp; ⚠️ Trip budget over by: ${formatCurrency(Math.abs(tripBudgetRemaining))}`
      : `&nbsp;|&nbsp; ${formatCurrency(tripBudgetRemaining)} remaining`;

  return `
    <div class="budget-row">
      💰 <strong>Day Estimate:</strong>
      ⛽ ${formatCurrency(budget.gasUsed)} fuel est.
      • 🏨 ${formatCurrency(budget.hotelCost)} hotel est.
      • 🍽️ ${formatCurrency(budget.foodEstimate)} meals est.
      • Est. total: <strong>${formatCurrency(budget.dayTotal)}</strong>
      ${tripBudgetHTML}
    </div>
  `;
}
```

**Done when:** Open mode PDFs show day cost breakdown with no "over by" language. Budget mode PDFs still show running remaining/over tracker inline.

---

### Part 2 — `trip-print-cover.ts` — Add Estimate Mode CTA in open mode

**File:** `src/lib/trip-print-cover.ts` (use the already-updated version from the per-person fix)

**Function:** `buildBudgetStatusCard`

In the `!hasBudget` branch, after showing the cost, add a soft CTA pointing to Estimate Mode.

**Current open-mode return (after per-person fix):**
```ts
if (perPerson && settings.numTravelers > 1) {
  headline = `${formatCurrency(perPerson)} per person`;
  detail = `${formatCurrency(costBreakdown.total)} total · ${settings.numTravelers} travelers`;
} else {
  headline = `Estimated trip cost: ${formatCurrency(costBreakdown.total)}`;
  detail = '';
}
```

**Add a `cta` variable and render it:**
```ts
if (perPerson && settings.numTravelers > 1) {
  headline = `${formatCurrency(perPerson)} per person`;
  detail = `${formatCurrency(costBreakdown.total)} total · ${settings.numTravelers} travelers`;
} else {
  headline = `Estimated trip cost: ${formatCurrency(costBreakdown.total)}`;
  detail = '';
}
// Soft CTA — promote Estimate Mode for future trip planning
const estimateCTA = `
  <div class="cover-estimate-cta">
    Want low/mid/high cost ranges before you commit?
    Try <strong>Estimate Mode</strong> at myexperienceengine.com
  </div>
`;
```

Then in the return HTML, add `${estimateCTA}` after the detail line, inside the card div:

```ts
return `
  <div class="cover-section">
    <div class="cover-section-label">Budget</div>
    <div class="cover-status-card ${cardClass}">
      <div class="cover-status-headline">${headline}</div>
      ${detail ? `<div class="cover-status-detail">${detail}</div>` : ''}
      ${!hasBudget ? estimateCTA : ''}
    </div>
  </div>
`;
```

**Note:** `estimateCTA` variable needs to be declared before the `return` and the `hasBudget` check wraps the CTA in the template literal. Simplest approach: declare `const showEstimateCTA = !hasBudget` before the if/else block, then use it in the template.

---

### Part 3 — `trip-print-styles.ts` — Style the CTA

**File:** `src/lib/trip-print-styles.ts`

Add after the existing `.cover-status-detail` rule:

```css
.cover-estimate-cta {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
  font-size: 9pt;
  color: #6b7280;
  line-height: 1.5;
  font-style: italic;
}

.cover-estimate-cta strong {
  color: #374151;
  font-style: normal;
}
```

---

## Behavior Summary

### Open Mode (no budget set)

**Cover page budget section:**
```
BUDGET
$315.00 per person                    ← headline (multi-traveler)
$630.00 total · 2 travelers           ← detail

Want low/mid/high cost ranges before  ← soft CTA (italic, small)
you commit? Try Estimate Mode at
myexperienceengine.com
```

**Day pages:**
```
💰 Day Estimate: ⛽ $75 fuel • 🏨 $90 hotel • 🍽 $100 meals • Est. total: $265
                                       ← no budget tracker, no "over by"
```

---

### Budget Mode (budget set, within)

**Cover page:** unchanged — shows remaining
**Day pages:**
```
💰 Day Estimate: ⛽ $75 fuel • 🏨 $90 hotel • 🍽 $100 meals • Est. total: $265  |  $735 remaining
```

---

### Budget Mode (budget set, over)

**Cover page:** unchanged — shows warning
**Day pages:**
```
💰 Day Estimate: ⛽ $75 fuel • 🏨 $90 hotel • 🍽 $100 meals • Est. total: $265  |  ⚠️ Trip budget over by: $265
```

---

## Delivery Checklist

- [ ] `trip-print-day.ts` — `buildBudgetHTML` rewritten, open-mode "over by" removed
- [ ] `trip-print-cover.ts` — Estimate Mode CTA added in open-mode budget card
- [ ] `trip-print-styles.ts` — `.cover-estimate-cta` CSS added

All files to `/mnt/user-data/outputs/` with original filenames.
No instructions. Working code only.

---

💚 My Experience Engine — Kitchen ticket by ZeeRah, Mar 19 2026

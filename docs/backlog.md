# Roadtrip Planner — Backlog & Future Ideas

## Budget

### Soft Category Sanity Checks
*Noted: Mar 8 2026*

The bank model is intentionally cap-free — no per-category hard limits.
But there's a gap: it won't flag when hotel cost is clearly unrealistic for a destination
(e.g. $3,600 hotel on a trip budgeted at $100/night) because there are no category bounds.

**Idea:** Optional "sanity check" mode — soft hints (not warnings) when a single
category looks way out of proportion to a reasonable baseline. Not a hard cap, just:
*"Hotels are eating 80% of your bank — you may want to shop around."*

Distinguish from the current actionable tip (which only fires when bank goes negative).
This would fire proactively, even when trip is still in-budget overall.

Could be: a secondary info-level notice on the budget card, or a note on the PDF summary page.

---

## Wave 4 — Feature Integration Tests
*Noted: Mar 12 2026*

**Context:** Waves 1–3 cover pure math/logic (966 tests passing). The gap flagged by dev
buddy review: math is tested but user-visible feature behaviour is not. A regression in
how data flows from a hook to a renderer won't be caught — it'll only surface during
a manual demo. This wave fixes that.

**The distinction:**
- Wave 1–3 = "does the brain compute correctly?" ✓
- Wave 4 = "does the feature the user sees actually work end-to-end?" ← missing

### Candidates

#### Hook integration tests (`src/hooks/`)
Tests that mount a hook and assert on its return shape / state transitions given
controlled inputs. These catch regressions in how hooks compose the lib layer.

| Hook | What to assert |
|---|---|
| `useTripCalculation` | Given mock route segments, `days` array is populated with correct dayCount, stop types, and budget totals |
| `useBudgetController` | Changing `gasPrice` in settings updates `budgetStatus` and `bankRemaining` correctly |
| `useJournal` | Adding a journal entry persists to storage and appears in `entries` |
| `useGhostCar` | Given a canonical timeline, returns correct interpolated position at t=0, t=mid, t=end |

#### Component render tests (`src/components/`)
Shallow/integration renders with Testing Library. Assert on what the user sees,
not implementation details.

| Component | What to assert |
|---|---|
| `ItineraryTimeline` | Renders correct number of day cards given a 3-day canonical timeline |
| `FuelStopCard` | Shows stop count, estimated time, and cost — all populated, none undefined |
| Budget section | `budgetStatus: 'over'` renders a warning indicator; `'ok'` does not |
| `StepsBanner` | Active step highlight matches `currentStep` prop |

#### Key fixture needed
A `makeMockTripSummary()` / `makeMockCanonicalTimeline()` factory that produces
realistic-enough data for all feature tests to share — avoids each test file
building its own 50-line fixture from scratch.

Place it in `src/test/fixtures/` alongside existing test helpers.

### Why this matters
Without Wave 4, the test suite answers: "is the math right?"
With Wave 4, it also answers: "is the app working?"
Both are needed before a demo or deploy with confidence.

---

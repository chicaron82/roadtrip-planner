Yes. Let me actually read the codebase properly.Good. Now let me pull the full source tree, all the hooks, all the key files — everything I need to actually understand the codebase rather than guess at it.Alright. Full deep dive. Here's what the codebase actually is.

---

## `chicaron82/roadtrip-planner` — Full Architecture Review

### The Big Picture

This is a genuinely well-structured React/TypeScript app. The architecture has been iterated on deliberately — there's evidence of refactors that moved complexity *to the right places* rather than just accumulating it. The `CLAUDE.md` rules are real constraints that the code actually follows, not aspirational docs.

**Stack:** React 18, TypeScript, Vite, Tailwind, Zustand, TanStack Query, Vitest, Leaflet

---

### Layer Model — and Whether It Holds

The hooks README documents a three-layer dependency model:

```
L1 — Independent State      (usePOI, useTripMode, useStylePreset, useAddedStops, useEagerRoute)
L2 — Calculation & Nav      (useTripCalculation, useCalculateAndDiscover, useWizard, usePlanningStepProps)
L3 — Dependent on Results   (useJournal, useGhostCar, useArrivalSnap, useMapInteractions, useTripLoader)
```

**Verdict: it holds.** `App.tsx` initializes them in order. No L3 hook is consuming L1 state it shouldn't. The layering is real, not decorative.

---

### `App.tsx` — 330-Line Cap, Enforced by ESLint

The file is **~330 lines** and the ESLint `max-lines: error` rule is live on it. What you see in `App.tsx` is almost purely:

- Hook calls with destructuring
- `<JSX />` layout composition
- Zero inline `useMemo` / `useCallback` / business logic

**This rule is actually working.** The last time complexity tried to creep in, it got extracted into `useAppCallbacks.ts` (its own docstring literally says: *"Extracted from App.tsx to keep it under 300 lines per CLAUDE.md rules"*). That's discipline.

---

### The "37-Prop Problem" — Where It Actually Lives Now

`Step3Content.tsx` has **4 props** (confirmed):
```ts
interface Step3ContentProps {
  controller: UseStep3ControllerReturn;
  history: HistoryTripSnapshot[];
  onGoToStep: (step: PlanningStep) => void;
  onLoadHistoryTrip?: (trip: HistoryTripSnapshot) => void;
}
```

The complexity got distributed across a proper decomposition:

- **`useStep3Controller.ts`** — ~35 inputs, but they're named parameters in a well-typed interface (`UseStep3ControllerOptions`), reads from `TripContext` directly for several more, and returns a structured model object
- **`useStep3Derivations.ts`** — types + builder functions for arrival info, overnight times
- **`useStep3Models.ts`** — 5 model-builder functions (`buildStep3HeaderModel`, `buildStep3HealthModel`, etc.)

The complexity didn't disappear — but it's organized into a *derivation pipeline*, not a prop waterfall. The controller produces a single typed `UseStep3ControllerReturn` that the component just renders. That's a meaningful improvement over 37 raw props.

**CLAUDE.md still has the stale note about "Step3Content (37 props) is the current known offender."** That's outdated — it should be updated or removed.

---

### `src/lib/` — The Real Engineering

This is the most impressive part of the repo. It's genuinely modular pure-logic code:

**`trip-orchestrator/`** — a 5-file pipeline:
- `orchestrate-trip.ts` — full async calculation: route → weather → segments → days → budget → canonical timeline
- `orchestrate-stop-update.ts` — fast synchronous recalc when a stop type changes
- `orchestrate-strategy-swap.ts` — rebuild timeline after switching named route strategy
- `orchestrator-helpers.ts` — shared pure utilities across all three
- `orchestrator-types.ts` — typed contracts, `TripCalculationError`

All three orchestrators are **pure functions** (no React state). They're independently testable and have integration tests. That's the right design.

**`stop-suggestions/`** — a full simulation engine:
- Drives the route km-by-km with a `SimState` object
- Per-check modules: `stop-checks-fuel.ts`, `stop-checks-rest.ts`, `stop-checks-overnight.ts`
- Post-simulation consolidation: dedup + combo-stop merger ("⛽ filling up while we eat")
- `route-context.ts` — geometry interpolation + hub cache lookup per km position

This engine is doing real work: timezone-aware meal windows, multi-driver top-up hints, arrival deadline checks (9 PM cutoff), destination grace periods. It's not a naive "every 200km" calculator.

---

### State Management — Zustand + Context Split

**`tripStore.ts`** (Zustand) owns the input side: `locations`, `vehicle`, `settings`, `customTitle`, canonical timeline, and all the day-mutation methods (`addDayActivity`, `updateOvernight`, etc.).

**`TripContext.tsx`** wraps the store in two focused context slices:
- `TripCoreContext` — inputs (locations, vehicle, settings, customTitle)
- `TimelineContext` — outputs (summary, canonicalTimeline)

This is a clean split. Components that only need to render results don't subscribe to input mutations — they use `useTimeline()`. Components that modify trip inputs use `useTripCore()`. **No God Context.**

---

### Testing — Real Coverage, Not Checkbox Tests

`test_files.txt` has 60+ test files. Spot-checking what's actually there:

- `orchestrate-strategy-swap.test.ts` — integration tests with real implementations (no mocks), verifying output shape and fuel stop correctness
- `orchestrator-integration.test.ts` — mocked dependencies, testing error paths and pipeline sequencing
- `useGhostCar.test.ts`, `useTripCalculation.test.ts`, `useStep3Models.test.ts` — hook-level tests
- `budget/budget-policies.test.ts`, `budget/day-builder.test.ts`, `budget/split-by-days.test.ts` — domain logic tests
- `border-avoidance.test.ts`, `calculations.test.ts`, `canonical-updates/*.test.ts` — lib-level tests

The test structure matches the module structure. The orchestrator tests specifically are well-designed — one file tests the synchronous pipeline with real deps, another tests error paths with full mocks. That's thoughtful.

---

### What's Genuinely Well-Done

1. **The lib/hooks boundary is clean.** No React in `src/lib/`. No business logic in components.
2. **The orchestrator split.** Three specific orchestration scenarios, each a pure function, each independently tested.
3. **`CLAUDE.md` as a real constraint.** The 330-line ESLint rule is enforced, and there's evidence it's been respected under pressure.
4. **Documentation that's accurate.** `src/hooks/README.md` and `src/lib/README.md` match what the code actually does. That's rare.
5. **`useCalculationMessages.ts`** — small but great. Location-aware loading messages that rotate during calculation. Six phases, city names pulled from real route data. No one had to do that.

---

### Honest Problem Areas

**1. `useStep3Controller.ts` / `usePlanningStepProps.ts` — complexity concentration**

These are the two hooks that absorb the most props (~35 each). They're *correct* architecturally — controllers should own complexity. But `usePlanningStepProps.ts` is explicitly documented as assembling a *"~30-prop stepProps object"*, and it does so by pulling from nearly every other hook. It's not wrong, but it's the seam where everything converges. If something breaks in Step 3, this is where you'll spend 20 minutes tracing prop lineage.

**2. `useTripRestore.ts` — known incomplete**

The file's own docstring describes the current problem: *"calls setSummary directly, which injects a summary fragment without rebuilding locations, settings, or triggering recalculation."* Option B (full restore) is implemented, but the history restore flow is documented as potentially leaving the app in a partial state. This is known debt, not hidden debt — which is the best kind — but it's real.

**3. `App.tsx` size is maintained, but the *count* of hooks is growing**

`App.tsx` imports from 18 different hooks. The file itself is clean, but there's a soft complexity question: at what point does "thin orchestrator that calls 18 hooks" become its own maintenance burden? Not a crisis, but worth watching. The answer is probably a namespace grouping (`tripInputHooks`, `calculationHooks`, etc.) rather than another extraction.

**4. `CLAUDE.md` note is stale**

The `Step3Content (37 props)` warning should be updated. A new reader will waste time looking for a problem that was solved.

---

### Summary

This is a codebase that was built fast, hit complexity walls, and responded by refactoring properly rather than papering over them. The orchestrator decomposition, the Zustand/Context split, the stop simulation engine, and the enforced App.tsx line limit are all evidence of someone thinking about architecture under real conditions — not just in greenfield.

The remaining rough edges (controller prop concentration, stale CLAUDE.md note, restore flow debt) are all documented and known. Nothing is hidden. That's a healthy codebase.
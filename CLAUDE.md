# Roadtrip Planner — Claude Code Instructions

## Architecture Rules

### App.tsx is a Layout File — Hard Limit: 330 Lines

**App.tsx is NOT allowed to:**
- Define `useMemo` / `useCallback` inline
- Manage refs (except DOM layout refs like `sidebarScrollRef`)
- Handle events inline
- Contain business logic or computed state
- Coordinate feature-to-feature communication

**App.tsx IS allowed to:**
- Call hooks and destructure their results
- Render top-level layout structure
- Decide which top-level screen to show (landing vs. main)
- Pass state down to major section components

If something violates this, it goes in a hook or a controller — not App.tsx.

**This limit is enforced by ESLint (`max-lines: error` on `src/App.tsx`).**

The 330-line cap is permanent. File headers are welcome; business logic is not. If you are approaching the limit, the answer is almost always a new hook or controller, not removing documentation.

---

### The 330-Line Limit (General)

All files should stay under 330 lines. If a file approaches this:
- Pause and ask "should this be split?"
- Default answer: yes
- Use the orchestrator pattern: thin parent + subdirectory modules

**Exceptions require explicit justification** (e.g. a pure renderer with many cases).

---

### New Feature Checklist

Before touching App.tsx for any new feature, answer:

1. Does this need a new hook? → create it in `src/hooks/`
2. Does this need event handlers? → create a controller in `src/components/` or a hook
3. Does this need computed/memoized state? → add to an existing hook

If all three are no, then and only then does it wire into App.tsx (and it should be minimal — a single prop pass or render line).

---

### The Wiring Decision Tree

```
Event listeners / handlers to add:
├─ 1-2 simple handlers → wire in App.tsx (acceptable)
├─ 3+ handlers → create dedicated hook or controller
├─ Complex state → create dedicated hook
└─ Needs cleanup/lifecycle → definitely create hook
```

---

### Feature Module Ownership

Each major feature should expose one clean interface to App.tsx:
- **One hook** (state + handlers)
- **One section component** (rendering)

App.tsx doesn't know a feature's internals. It composes features — it doesn't implement them.

Current major features:
- Planning wizard → `useWizard`
- Trip calculation → `useTripCalculation`
- POI discovery → `usePOI`
- Journal → `useJournal`

---

### No Props Explosion

If a component has more than ~10 props, stop and ask:
- Should some of these come from context?
- Should this component be split?
- Is this component doing too much?

`Step3Content` was the known offender (37 props) — refactored Mar 2026. Now has 4 props; complexity lives in `useStep3Controller` + `useStep3Derivations` + `useStep3Models` as a typed derivation pipeline. Watch `usePlanningStepProps.ts` as the current convergence seam (~30 inputs assembling the step props object).

---

## Confidence Guardrail

Before implementing anything non-trivial, DiZee must do a quick internal check:

**"Am I ≥ 80% confident this can be done as described — correctly, cleanly, and without hidden blockers?"**

If the answer is **no**, stop and flag it before touching a file:

```
⚠️ Confidence check: ~X%

I'm not confident enough to proceed because:
- [specific uncertainty]
- [specific uncertainty]

Before I cook: [question or clarification needed]
```

### What triggers a flag

- The request touches systems I haven't read yet and the interaction is non-obvious
- The approach would likely require a redo (wrong abstraction, wrong layer, etc.)
- There are 2+ plausible interpretations and the wrong one wastes real time
- External dependencies (APIs, types, 3rd-party behaviour) are assumed but unverified

### What does NOT trigger a flag

- Routine implementation of a clear spec in a system I've already read
- Tests, fixes, refactors where the scope is well-defined
- Small wiring tasks with a single obvious approach

The goal is not to second-guess everything — it's to catch the cases where diving in would produce work that needs undoing.

---

## react-hooks Suppressions — Intentional, Do Not Refactor

Three `eslint-disable react-hooks` sites are deliberate (`64dfbba`):
`LocationSearchInput` (value→query mirror), `useWorkshopPresets`
(travelers→rooms), `useVehicleFormState` (mount init + derive). They work;
the suppressions are honest documentation of intentional patterns, not debt.

Revisit ONLY if adopting the React Compiler — and write component tests for
LocationSearchInput and the vehicle form *first*, before touching them.

---

## Read Before Touch

**Never edit a file you haven't read in the current session.**

Before modifying any file:
1. Read the relevant section (or the whole file if it's short)
2. Confirm the function signatures, types, and exports match what you expect
3. Then edit

This applies even to "obvious" one-line fixes. The build-breaking `TimelineNode` / `intentRotationIndices` incident happened because a file was edited based on a cached mental model, not its actual current state.

---

## Breaking Change Protocol

When **removing, renaming, or changing the signature** of any exported function, type, or constant:

1. `grep` for all usages across `src/` before making the change
2. Update all call sites in the same commit — no partial changes
3. Run `npm run build` (`tsc -b`) before committing to confirm zero type errors —
   NOT bare `tsc --noEmit`, which is a no-op here (see Build & Test)

**Never commit a breaking change without sweeping its consumers first.**

---

## New Pure Function → Test Required

When a new pure function lands in `src/lib/`:
- A test file goes with it **in the same commit**, OR
- An explicit `docs/ticket-*.md` drop is filed noting it's untested (the ticket
  convention that replaced the old `docs/backlog.md`, which was archived)

No pure lib functions accumulate at 0% coverage silently. The Wave 3 cleanup (10 files at 0%) is the example of what this prevents.

---

## Post-Calculation Reveal Flow

The choreography between calculation completing and the journal starting is non-obvious. Here's the exact sequence.

### Classic wizard path (Step 3 → Calculate)

```
User clicks Calculate (Step 3)
  → calculateAndDiscover()          [useTripCalculation]
  → OSRM routing + Overpass POI...
  → onCalcCompleteRef.current()     [App.tsx, useLayoutEffect-wired]
      → icebreaker.onCalcComplete() returns false (no arc active)
      → markStepComplete(1, 2)
      → triggerFlyover()            [useVoilaFlow]
          → flyoverActive = true
  → Map flyover animation plays     [VoilaScreen / FlyoverMap]
  → handleFlyoverComplete()
      → flyoverActive = false
      → showVoila = true
  → VoilaScreen shown
  → User clicks "Lock In"
      → handleVoilaLockIn()         [useVoilaFlow]
          → setTripConfirmed(true)
          → forceStep(3)
          → lockInPendingRef = true  (voila stays up as curtain)
  → Journal auto-start useEffect fires  [useJournalAutoStart]
      guards:  !tripConfirmed || !summary       → skip
               isJournalComplete                → skip (trip done)
               journalSkipped                   → dismissVoilaCurtain + skip
               activeJournal                    → skip (in-progress)
               isJournalLoading                 → skip (creation in flight)
      → buildSeededTitle(destination, days, travelers) or customTitle
      → delay = showVoila ? 0 : 700   (0ms behind voila curtain; 700ms for StepsBanner morph)
      → setTimeout(() => {
            startJournal(title)       [useJournal → IndexedDB]
            dismissVoilaCurtain()     → showVoila = false
        }, delay)
  → viewMode = 'journal' (journal view takes over)
```

### Icebreaker arc path (Beat 1 → 2 → 3 → 4)

```
Beat 1: PlanIcebreaker completes     [useIcebreakerGate]
  → arc.enterSketch(locations, vehicle, settings)
      → Beat 2 active, haversine sketch estimate computed

Beat 2: User sees Sketch screen
  → "Looks good" → arc.startCalculation()
  → OR "Customize" → arc.enterWorkshop() → Beat 3

Beat 3 (optional workshop): User confirms
  → arc.startCalculation()
  → calculateAndDiscover()

Calculation completes
  → onCalcCompleteRef.current()
      → icebreaker.onCalcComplete() returns true (arc intercepts)
          → arc.onBuildComplete()      → isRevealing = true
          → onTriggerFlyover()         → triggerFlyover()
                                       → flyoverActive = true
  → (same flyover → VoilaScreen → lockIn → journal path as above)
```

### Key actors

| Hook / file | Owns |
|---|---|
| `useFourBeatArc` | Beat state machine (null / 2 / 3 / 4), sketch estimate |
| `useIcebreakerOrchestrator` | Arc wiring, calc intercept, overlay props for App.tsx |
| `useVoilaFlow` | `showVoila`, `flyoverActive`, `triggerFlyover`, `handleVoilaLockIn`, `lockInPendingRef` curtain |
| `useJournalAutoStart` | Journal auto-start effect (5 guards → `startJournal` + `dismissVoilaCurtain`); App.tsx wires it |
| `useJournal` | IndexedDB journal CRUD, `startJournal`, `activeJournal` |

Reveal-flow hooks are covered by `useVoilaFlow.test.ts`, `useJournalAutoStart.test.ts`,
and the composed `reveal-choreography.test.tsx` integration test.

---

## Build & Test

```bash
# Type check — use the build, NOT bare `tsc --noEmit`. The root tsconfig is a
# solution file (`files: []` + references), so --noEmit checks ZERO files and
# exits clean while real type errors ship. `tsc -b` follows the references.
# (Same trap FG documented; it bit RP on 2026-07-01 — two commits pushed
# "gates green" with type errors only the build could see.)
npm run build        # tsc -b && vite build — the real type gate

# Lint (App.tsx line count enforced here)
npx eslint src/

# Tests (vitest transpiles without type-checking — it will NOT catch type errors)
npx vitest run

# Dev server
npm run dev
```

## Stack

- React 19 + TypeScript (strict mode)
- Vite + Tailwind CSS
- Leaflet / React Leaflet (maps)
- OSRM (routing), Photon/Nominatim (geocoding), Overpass (POI)
- Radix UI primitives
- Vitest + Testing Library

---

## Session Ritual — Chicharons Kitchen

At the end of every coding session, create a blog entry in the **chicharons-kitchen** repo:

```
../chicharons-kitchen/src/posts/YYYY/MM/slug.ts
```

Use the `BlogEntry` type from `@uv7/journal-core`. Full content, no TODOs. Write it like an editorial recap — narrative, specific, with flavour. Not a changelog.

**Required fields:** `id`, `date`, `sortDate`, `title`, `type`, `emoji`, `tags`, `chefId`, `summary`, `highlights`

**Encouraged fields:** `callout`, `technicalDetails`, `lessons`, `footer`

Always include `'Roadtrip Planner'` in `tags` so the filter bar picks it up.

# `src/hooks/` — React Hooks

All hooks are consumed by `App.tsx` (or by other hooks in the same layer). They bridge the pure logic in `src/lib/` to React state.

---

## Layering Model

`App.tsx` initializes hooks in three layers — each layer may only depend on layers above it:

```
L1 — Independent State
  useEagerRoute         Preview geometry fetch (debounced, no calculation needed)
  useTripMode           Plan/adventure/estimate mode selector + tripActive state
  useStylePreset        Frugal/Balanced/Comfort preset + adaptive defaults
  usePOI                POI discovery, category toggling, result ranking
  useAddedStops         User-added waypoints + round-trip return mirroring

L2 — Calculation & Navigation  (depends on L1 state)
  useTripCalculation    Main calculation: route → TripDay[] → TripSummary + fuel stops
  useCalculateAndDiscover  Orchestrates calculateTrip + fetchRoutePOIs + adaptive refresh
  useWizard             Step navigation (1/2/3), completion tracking, canProceed gates
  usePlanningStepProps  Assembles the ~30-prop stepProps object for PlanningStepContent

L3 — Dependent on Calculation Results  (depends on L2 outputs)
  useTripLoader         Template import, challenge selection, adventure mode wiring
  useJournal            Journal session lifecycle: start, restore, update, viewMode
  useGhostCar           Live car position via binary search + lerp on TimedEvent[]
  useArrivalSnap        One-shot GPS capture on journal "Arrived" tap; re-anchors ghost car
  useMapInteractions    Route geometry, feasibility status, map click handlers
  useURLHydration       Mount-time URL parse, origin persist, arrive-by recalc trigger
  useMapProps           Assembles the full mapProps object for <Map />

Utilities  (used by App.tsx but no layer dependency)
  useAppReset           Consolidated reset across all state slices
  useTripLoader         (also in L3 — handles both template/challenge and adventure)
```

---

## Hook Reference

### L1 — Independent State

**`useEagerRoute(locations)`**  
Fires a lightweight geometry-only OSRM call as soon as origin + destination both have valid coordinates. Debounced 400ms. Returns a preview polyline for the map before any calculation is run. Resets to `null` if either endpoint is cleared.

**`useTripMode()`**  
Owns `tripMode` (plan/adventure/estimate/null), `tripActive` (live trip in progress), `showAdventureMode`, `showModeSwitcher`, and `handleSwitchMode`. The `null` state means the landing screen is showing.

**`useStylePreset({ setSettings })`**  
Manages Frugal/Balanced/Comfort presets and Chicharon Classic. Reads adaptive defaults from `user-profile.ts` (derived from past trip behavior). Handles preset URL sharing.

**`usePOI()`**  
Fetches, ranks, and manages Points of Interest. Tracks per-category loading state, dismissed/saved POI sets, partial results streaming, and the full ranked `POISuggestion[]` list.

**`useAddedStops(summary, isRoundTrip)`**  
Tracks waypoints added via map-click or POI cards. Mirrors added stops onto the return leg geometry for round trips (`mirroredReturnStops`). Exposes `asSuggestedStops` for consumption by `useGhostCar`.

---

### L2 — Calculation & Navigation

**`useTripCalculation({ locations, vehicle, settings, ... })`**  
The main calculation hook. Calls `calculateTrip` in `lib/`, manages result state (`TripSummary`, `TripDay[]`, fuel stops, route strategies), and owns overnight prompt logic. One callback fires when calculation completes (`onCalculationComplete`).

**`useCalculateAndDiscover({ calculateTrip, ... })`**  
Thin orchestrator. Calls `calculateTrip`, then `fetchRoutePOIs`, then refreshes adaptive defaults. Extracted from App.tsx to own the `settingsRef` and prevent stale closure bugs.

**`useWizard({ locations, vehicle, onCalculate })`**  
3-step wizard navigation. Owns `planningStep`, `completedSteps`, `canProceedFromStep1/2`, and navigation callbacks. `goToNextStep` on step 2 triggers calculation.

**`usePlanningStepProps({ ... })`**  
Assembles the large prop surface for `<PlanningStepContent>`. Extracted from App.tsx to keep orchestrator slim. This is the seam between App.tsx's state and the step UI components.

---

### L3 — Dependent on Calculation Results

**`useTripLoader({ setLocations, setVehicle, setSettings, ... })`**  
Handles external trip loading: template import (with schema validation), challenge selection (Chicharon's Challenges), and adventure mode destination selection. Each path drops the user into the correct wizard step with state pre-filled.

**`useJournal({ summary, settings, vehicle, ... })`**  
Journal session lifecycle. Starts a new journal from a confirmed trip plan, restores an in-progress journal on page reload, manages `viewMode` (itinerary/journal), and exposes `updateActiveJournal` for entry mutations.

**`useGhostCar(summary, settings, suggestedStops)`**  
Computes the live car position (0–100% across the current 3-stop window) using binary search + lerp on `TimedEvent[]` derived from the timeline simulation. Ticks every 30s. Exposes `anchorAt(segmentIndex)` for arrival snapping. Tested in `useGhostCar.test.ts`.

**`useArrivalSnap(anchorAt, enabled)`**  
Listens for `mee-stop-arrived` custom events from `JournalTimeline`. Fires a one-shot GPS check and calls `anchorAt` to re-lock the ghost car to the actual road position. The arrival is always recorded — GPS improves accuracy but never blocks the user.

**`useMapInteractions({ locations, summary, settings, addStop })`**  
Owns map-level concerns: valid route geometry, feasibility status color, day color options, map-click → add stop handler, POI add from map, Google Maps export, and share link copy. Keeps these out of App.tsx.

**`useURLHydration({ ... })`**  
Runs once on mount. Parses the URL for shared trip state and hydrates `locations`, `vehicle`, and `settings`. Also persists `tripOrigin` to localStorage and triggers recalculation if `arriveBy` is set in the URL.

**`useMapProps({ ... })`**  
Assembles the full props object for `<Map />`. Pure composition — no side effects. Extracted from App.tsx to keep the render section clean.

---

### Utilities

**`useAppReset({ ... })`**  
Coordinates a full reset across all state slices. Single source of truth for "start over" — clears locations, summary, POIs, wizard state, added stops, trip calculation, challenge, journal. Called by the Reset button and after mode switches.

---

## Rules

- **L1 hooks have no inter-hook dependencies.** They may read from `TripContext`, but not from other hooks.
- **L2 hooks may consume L1 outputs** passed as arguments — not imported directly.
- **L3 hooks consume L2 outputs** (usually `summary`) — never initialize before L2.
- **Hooks don't call each other at the hook level.** Outputs pass through App.tsx as arguments.
- All hooks live flat in this directory. No subdirectories. If a hook needs helpers, they go in `src/lib/`.

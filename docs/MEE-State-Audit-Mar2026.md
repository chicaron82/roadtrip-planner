# MEE — Full State Audit
**My Experience Engine** | March 16, 2026
*Replaces MEE-Coverage-Audit-ENHANCED.md — that doc was a sprint plan. This is the post-sprint reality check.*

---

## 📊 Where We Are

```
105 test files  (was 58 at last audit)
1,997 test assertions  (was ~678)
67,792 total lines across 435 files
```

**The coverage arc:**
- Feb 28: ~40% / 430 tests / 58 files
- Mar 13: ~58% / 58 test files
- Mar 16: **105 test files / ~1,997 assertions**
- Estimated current coverage: **80–85% statements** (past the 75% target, approaching stretch goal)

The sprint plan that was mapped as 4 weeks got executed in days. Every P0 and P1 item is closed.

---

## ✅ What's Solid — Don't Touch

### Core Engine (src/lib/) — Well Covered
The pure-logic layer is the strongest part of the codebase. These are tested, stable, and clean:

| Module | Status | Notes |
|--------|--------|-------|
| Route calculation / OSRM math | ✅ Solid | calculations.test.ts — comprehensive |
| Stop suggestion engine | ✅ Solid | Full simulation + per-check modules tested |
| Overnight snapper | ✅ Solid | overnight-snapper.test.ts |
| Driver rotation | ✅ Solid | Fair 4-way split fix landed Mar 15 |
| Border avoidance | ✅ Solid | Dedicated test file |
| Segment analyzer | ✅ Solid | Covered |
| Timeline simulation | ✅ Solid | 495-line test file |
| Feasibility engine | ✅ Solid | 779-line test file — most comprehensive in the repo |
| Hub cache | ✅ Solid | 740-line test file |
| Budget system | ✅ Solid | split-by-days, day-builder, sanity-hints all covered |
| POI ranking | ✅ Solid | poi-ranking.test.ts |
| Accepted itinerary pipeline | ✅ Solid | Both projection + timeline tested |
| Canonical updates | ✅ Solid | All four sub-modules tested |
| Trip timeline system | ✅ Solid | timeline, day-state, location all covered |
| Storage layer | ✅ Solid | garage, budget, style-presets, user-profile all tested |
| Adventure service | ✅ Solid | Core logic covered |
| Regional costs | ✅ Solid | Was P1 gap — now closed |
| Discovery engine | ✅ Solid | Was P1 gap — now closed |
| Departure optimizers | ✅ Solid | Was 0% — now tested (outbound + return in one file) |
| Estimate service | ✅ Solid | Was 0% — now closed |

### Scenario Pack Tests — A Genuine Highlight
`scenario-packs.test.ts` (560 lines) runs full end-to-end chains against named Canadian route profiles (Winnipeg–Thunder Bay, Winnipeg–Calgary, etc.) and asserts on *feel*, not fake precision. This is the kind of test that catches regressions that unit tests miss. Solid design.

### Voice / Copy Layer — New and Clean
`mee-tokens.ts` and `mode-voice.ts` exist as a single source of truth for all UI copy, with full test coverage. The distinction between Auto (engine-led) and Manual (user-led) mode framing is enforced at compile time. This is architecturally mature — surfaces can't drift out of spec.

### Architecture — Holding Under Pressure
- App.tsx: 325 lines (under the 330 ESLint cap, with L1/L2/L3 section comments now in place)
- Hook layer model (L1 independent → L2 calculation → L3 live journey) is real, not decorative
- Orchestrator split: 3 pure-function orchestrators, each independently tested
- Nominatim-primary / Photon-fallback geocoding landed Mar 15 — correct call, Photon was missing major Canadian cities

---

## ⚠️ Polish Areas — Kitchen Notes for Next Session

### 1. BudgetProfilesSection — Missing from Settings Panel
**Status:** Not built  
**Context:** The backlog spec called for 5 Settings sections. 4 shipped (MyDefaults, TravelStyle, Privacy, About). BudgetProfilesSection is the missing piece.  
**Why it matters:** The full storage layer already exists (`getBudgetProfiles`, `saveBudgetProfile`, `setDefaultBudgetProfile`, `removeBudgetProfile`). The UI is the only thing missing. Users can't actually access saved budget profiles through the Settings panel yet.  
**Effort:** Low — other sections average ~100–125 lines. Storage layer is ready.

---

### 2. Settings Panel — No Tests
**Status:** 0% coverage on all 5 Settings components  
**Components:** `SettingsPanel.tsx`, `MyDefaultsSection.tsx`, `TravelStyleSection.tsx`, `PrivacySection.tsx`, `AboutSection.tsx`  
**Why it matters:** Privacy section has a "clear all data" path. That's the one that deserves a smoke test — wrong wiring on a destructive action is a real risk.  
**Effort:** ~2h — smoke tests for clear-all, privacy toggles, defaults persistence.

---

### 3. Overnight Intent Waypoints — Known Tracked Gap
**Status:** Documented TODO in `orchestrate-trip.ts` line 113  
**The gap:** When a user declares a waypoint as an overnight stop, the engine *suppresses duplicate fuel/rest stops* correctly — but it doesn't yet *pin the day boundary* at that waypoint. A user who says "I'm sleeping in Kenora" might still have the engine split days at a different point.  
**Note:** This is a deeper integration (requires `splitTripByDays` changes). It's not a bug that breaks the app — it's a fidelity gap in intent-following.  
**Effort:** Medium — needs `split-by-days` integration. Not trivial.

---

### 4. useStep3Controller — No Test File
**Status:** 336 lines, 0% coverage  
**Why it matters:** This is the central orchestration hub for Step 3. The review called it "the 20-minute trace zone when something breaks." Testing it won't prevent all pain, but it establishes a baseline you can diff against when something changes.  
**Effort:** ~3h — similar to `useTripCalculation.test.ts` pattern (mock orchestrator, assert on state transitions).

---

### 5. trip-print-builders.ts — No Test File
**Status:** 269 lines, 0% coverage  
**Context:** `trip-print-cover.test.ts` and `trip-print-day.test.ts` exist. `trip-print-builders.ts` (the coordinator that assembles the full print payload) doesn't.  
**Effort:** ~1.5h — pure function, straightforward to test.

---

### 6. API Layer — Still 0%
**Status:** `api.ts`, `api-geocoding.ts`, `api-routing.ts`, `weather.ts` — all untested  
**Note:** These are external-facing wrappers. The risk is external dependency behavior, not internal logic. Worth mock-testing request shapes and error handling.  
**Effort:** ~4h total. Lower priority than items above.

---

### 7. FEATURES.md — Two Stale Lines
**Status:** Minor but worth fixing before sharing with anyone  
```
STALE: "678 tests across 40 test files"
ACTUAL: ~1,997 assertions across 105 test files

STALE: "OpenWeatherMap" in the stack table
ACTUAL: Open-Meteo (already correct in the footer attribution, wrong in FEATURES.md)
```

---

### 8. backlog.md — Wave 4 and Settings Sections Need Closure Notes
**Status:** Both items shipped but backlog still reads as open  
- Wave 4 component tests: ✅ Done — 15 component test files now exist covering Health, Itinerary, Journal, Viewer, StepHelpers surfaces
- Settings panel: ✅ Partially done — 4 of 5 sections shipped, BudgetProfilesSection outstanding
- Step UX accordion: ✅ Done — `CollapsibleSection` built and wired into Step 1 (arrival target, round-trip mode) and Step 2 (Travelers, Accommodation, Driving, Style)

---

## 🗂️ Design Specs vs Implementation Status

Several design specs in `docs/` exist. Cross-referencing against the code:

| Spec | Status |
|------|--------|
| Signature Premium Trip Summary Card | ✅ Shipped — `TripSignatureCard.tsx` + `trip-signature-card-model.ts`, tested |
| Cinematic Results Reveal | ✅ Partially shipped — `TripArrivalHero.tsx` exists, reveal animation hook exists |
| Declared vs Inferred vs Discovered Design Language | ✅ Shipped — `mee-tokens.ts` + `SourceTierChip` component |
| Editorial MEE Voice | ✅ Shipped — `mode-voice.ts` + `mee-tokens.ts` |
| Auto vs Manual Mode | ✅ Shipped — mode-aware copy builders live, tested |
| Friendly Location Strings | ✅ Shipped — `location-sanitizer.ts` tested |
| Map as a Story | ⚠️ Partially shipped — animated polyline + day color coding exist, fuller narrative layer TBD |
| Print as a Journal Brief | ⚠️ Partially shipped — print pipeline exists, journal threading landed Mar 15 |
| Restraint, Rhythm, and Premium Control | 🔲 Whiteboard — UX feel spec, not a code deliverable |
| Signature Luxury Moment | 🔲 Whiteboard — partly addressed by TripSignatureCard |
| Step 1 as a Trip Intent Surface | ✅ Partially shipped — accordion landed, source tier chips exist |

---

## 🔲 Still Deferred (No Change)

**OSRM Public Server Dependency** — still the highest production risk item. App depends on the public OSRM demo server with no fallback. GraphHopper/ORS hot-standby is the recommended path. This hasn't moved since Mar 9. Worth revisiting if the app gets real traffic.

---

## 📋 Recommended Next Kitchen Tickets (Priority Order)

1. **BudgetProfilesSection** — complete the Settings panel (low effort, high polish)
2. **Settings smoke tests** — especially Privacy clear-all path (~2h)
3. **useStep3Controller test** — baseline coverage on the convergence seam (~3h)
4. **FEATURES.md corrections** — 5 minute fix, needed before sharing externally
5. **backlog.md closure notes** — mark Wave 4 and accordion as done
6. **trip-print-builders test** — close the last print pipeline gap (~1.5h)
7. **Overnight intent waypoint pinning** — deeper work, needs split-by-days integration (medium effort, real fidelity gain)

---

## Summary

The codebase is in genuinely strong shape. The architecture is clean, the test suite went from "demo risk" to "real safety net" in two weeks, and the voice/copy layer being typed and tested is a detail that most apps never bother with. The remaining gaps are mostly finishing work — not structural debt.

The one thing worth keeping an eye on: the OSRM dependency is still a production risk that gets more real with every user. That's the deferred item with the highest stakes.

💚 My Experience Engine

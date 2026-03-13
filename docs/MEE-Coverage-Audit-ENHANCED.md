# MEE — Test Coverage Audit (Enhanced)
**My Experience Engine** | March 2026

---

## 📊 Overall Coverage Stats

```
58 test files
58% statements | 51% branches | 62% functions | 61% lines
```

**Coverage Trend:**
- Feb 28: ~40% coverage (430 tests)
- Mar 11: ~48% coverage (678 tests)
- Mar 13: ~58% coverage (58 files)
- **Trend: ↗️ +18% in 2 weeks**

**Gap Analysis:**
Coverage is engine-heavy and UI-light. Pure logic functions are well tested; the API layer, POI system, and all React components/hooks are largely untested.

---

## 🎯 Quick Wins (< 1h each, high ROI)

Do these FIRST to build momentum and get coverage % up:

| Module | Effort | Why Easy | Impact |
|--------|--------|----------|--------|
| regional-costs.ts | 30 min | Pure functions, no mocks | Affects all overnight costs |
| discovery-engine.ts | 1h | 175 lines pure logic | Core UX (tier labels) |
| estimate-service.ts | 45 min | Pure math | Powers Estimate mode |
| border-avoidance.ts | 20 min | Already tested elsewhere | Just needs dedicated file |

**Total Quick Win Time: ~3 hours**
**Coverage Gain: Estimated +5-7%**

---

## 🔥 Priority Gaps — Fix Order

### P0 — Fix Now (Critical Path)

| Area | Risk | Effort | Recommendation | Done When |
|------|------|--------|----------------|-----------|
| **poi.ts + usePOI** | 🔥 CRITICAL | 2h | Test toggleCategory → Overpass → map pins | ✅ Category toggle fires query<br>✅ Pins render on map<br>✅ Error handling tested |
| **poi-service/** | 🔥 CRITICAL | 4h | Mock Overpass, test query builder + cache | ✅ Query builder produces valid Overpass QL<br>✅ Geo bbox calculation tested<br>✅ Cache hit/miss logic verified |

**P0 Total: 6 hours**

**Why P0:**
- Broke in live demo (poi.ts)
- User-facing feature failure
- External API dependency (Overpass)
- Zero coverage = zero safety net

---

### P1 — High Value (Core Flows)

| Area | Risk | Effort | Recommendation | Done When |
|------|------|--------|----------------|-----------|
| **orchestrateTrip()** | HIGH | 6h | Mock OSRM + fixture-based integration test | ✅ Full pipeline tested with fixtures<br>✅ Route failure handled<br>✅ Weather timeout doesn't block<br>✅ Round trip segments built correctly |
| **discovery-engine.ts** | MEDIUM | 1h | Test tier logic (No-Brainer / Worth-Detour) | ✅ Tier assignments match expected scores<br>✅ Time budget filtering works<br>✅ Detour cost calculated correctly |
| **useTripCalculation** | HIGH | 4h | React Query + abort + generation counter | ✅ Abort controllers cancel on unmount<br>✅ Generation counter prevents stale updates<br>✅ Error states handled<br>✅ Loading states correct |
| **regional-costs.ts** | LOW | 30m | Test hotel multipliers by region | ✅ All province/state multipliers tested<br>✅ Fallback to default works |
| **outbound optimizer** | MEDIUM | 3h | Test departure time suggestions | ✅ Combo timing optimization verified<br>✅ Early/late warnings trigger correctly |
| **return optimizer** | MEDIUM | 3h | Test return leg timing | ✅ Return departure suggestions tested<br>✅ Destination dwell time calculated |

**P1 Total: 17.5 hours**

**Why P1:**
- orchestrateTrip = used on every calculation
- useTripCalculation = 324 lines, core hook
- Discovery engine = core UX differentiator
- Regional costs = affects every overnight trip

---

### P2 — Medium (Important but Not Urgent)

| Area | Risk | Effort | Recommendation | Done When |
|------|------|--------|----------------|-----------|
| **journal-storage** | MEDIUM | 2h | Test save/load/read operations (currently 31%) | ✅ Save persists correctly<br>✅ Load restores state<br>✅ Corrupted data handled |
| **Settings panel** | LOW | 2h | Smoke tests for privacy/clear-all | ✅ Clear all data works<br>✅ Privacy toggles persist<br>✅ Default settings load |
| **estimate-service.ts** | LOW | 45m | Test cost estimate ranges | ✅ Low/mid/high ranges calculated<br>✅ Per-category breakdown correct |

**P2 Total: 4.75 hours**

---

### P3 — Low (Background Priority)

| Area | Risk | Effort | Recommendation | Done When |
|------|------|--------|----------------|-----------|
| **Print pipeline** | LOW | 3h | Test cover + formatters | ✅ Cover page renders<br>✅ Formatters produce valid HTML |
| **API layer** | MEDIUM | 4h | Mock tests for weather/geocoding | ✅ Request shape verified<br>✅ Timeout handling tested<br>✅ Error responses handled |

**P3 Total: 7 hours**

---

## 📋 Total Effort Summary

```
P0 (Critical):     6h
P1 (High Value):  17.5h
P2 (Medium):       4.75h
P3 (Low):          7h
─────────────────────
TOTAL:            35.25h

Quick Wins:        3h
Remaining:        32.25h

Sprint Plan:
- Week 1: P0 + Quick Wins = 9h
- Week 2: P1 (orchestrateTrip + useTripCalculation) = 10h
- Week 3: Remaining P1 + P2 = 12h
- Week 4: P3 (if time allows)
```

---

## 🎯 Success Metrics

**Target Coverage:**
```
Current:  58% statements
Target:   75% statements (after P0 + P1)
Stretch:  85% statements (after P2)
```

**Definition of Done:**
- All P0 items complete (6h)
- All P1 items complete (17.5h)
- Coverage ≥ 75%
- No critical user flows untested

---

## 📊 Detailed Coverage Breakdown

### 1. Core Planning Engine

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Route calculation (OSRM) | ✅ Good | High | calculations.test.ts | — | Core math well covered |
| Trip orchestration pipeline | ⚠️ Partial | Low | trip-orchestrator.test.ts | 6h | Only helpers tested — orchestrateTrip() untested |
| Input validation | ✅ Good | High | validate-inputs.test.ts | — | Covered |
| Stop suggestion engine | ✅ Good | High | stop-suggestions.test + checks | — | Fuel/overnight/rest tested |
| Overnight snapper | ✅ Good | High | overnight-snapper.test.ts | — | Covered |
| Driver rotation | ✅ Good | High | driver-rotation.test.ts | — | Covered |
| Border avoidance | ✅ Good | High | border-avoidance.test.ts | — | Covered |
| Outbound departure optimizer | ❌ None | 0% | — | 3h | 185 lines, affects timing suggestions |
| Return departure optimizer | ❌ None | 0% | — | 3h | 166 lines, return leg timing |
| Segment analyzer | ✅ Good | High | segment-analyzer.test.ts | — | Covered |
| Timeline simulation | ✅ Good | High | timeline-simulation.test.ts | — | Covered |

**Risk Assessment:**
- **HIGH:** orchestrateTrip untested (main pipeline)
- **MEDIUM:** Departure optimizers (affect every trip)

---

### 2. Budget System

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Budget calculation | ✅ Good | High | budget.test.ts + day-builder | — | Well covered |
| Regional cost multipliers | ❌ None | 0% | — | 30m | 188 lines, hotel prices untested |
| Budget sanity hints | ✅ Good | High | sanity-hints.test.ts | — | Covered |
| Budget sensitivity | ✅ Good | High | feasibility/sensitivity.test.ts | — | Covered |
| Budget split by days | ✅ Good | High | split-by-days.test.ts | — | Covered |
| Estimate service | ❌ None | 0% | — | 45m | 210 lines, Estimate mode pipeline |

**Risk Assessment:**
- **LOW:** Regional costs (pure functions, easy to test)
- **LOW:** Estimate service (pure math)

---

### 3. POI & Discovery System

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| POI toggle / map markers | 🔥 Critical | 0% | — | 2h | **BROKE IN DEMO** — poi.ts + usePOI |
| POI service (Overpass) | 🔥 Critical | 0% | — | 4h | Query builder, geo, cache all 0% |
| POI suggestions (corridor) | ⚠️ Partial | Low | usePOISuggestionHelpers.test | — | Helpers tested, pipeline not |
| POI ranking | ✅ Good | High | poi-ranking.test.ts | — | Covered |
| Discovery engine | ❌ None | 0% | — | 1h | 175 lines pure functions, tier logic |
| Hub cache / detection | ✅ Good | High | hub-cache.test.ts | — | Covered |

**Risk Assessment:**
- **🔥 CRITICAL:** POI service (broke in demo, 0% coverage)
- **HIGH:** Discovery engine (core UX, easy to test)

---

### 4. Feasibility Engine

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Feasibility analysis | ✅ Good | High | feasibility.test.ts | — | Covered |
| Timing analysis | ✅ Good | High | analyze-timing.test.ts | — | Covered |
| Sensitivity analysis | ✅ Good | High | feasibility/sensitivity.test.ts | — | Covered |
| Planner rationale | ✅ Good | High | planner-rationale.test.ts | — | Covered |

**Risk Assessment:**
- **LOW:** Feasibility well covered

---

### 5. Trip Timeline & Canonical System

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Trip timeline | ✅ Good | High | trip-timeline.test.ts | — | Covered |
| Timeline day state | ✅ Good | High | trip-timeline-day-state.test.ts | — | Covered |
| Timeline location | ✅ Good | High | trip-timeline-location.test.ts | — | Covered |
| Canonical updates (activities) | ✅ Good | High | day-activities.test.ts | — | Covered |
| Canonical updates (metadata) | ✅ Good | High | day-metadata.test.ts | — | Covered |
| Canonical updates (overnight) | ✅ Good | High | overnight.test.ts | — | Covered |
| Canonical trip contract | ❌ None | 0% | — | 1h | 117 lines, type contract untested |
| Accepted itinerary projection | ✅ Good | High | accepted-itinerary-projection.test | — | Covered |
| Accepted itinerary timeline | ✅ Good | High | accepted-itinerary-timeline.test | — | Covered |

**Risk Assessment:**
- **LOW:** Timeline system well covered
- **MEDIUM:** Canonical trip contract (easy to test)

---

### 6. Journal System

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Journal storage helpers | ⚠️ Partial | 31% | journal-storage.test.ts | 2h | Save/load at 31% coverage |
| Journal export | ❌ None | 0% | — | 2h | Export/print format untested |
| Journal trip view | ✅ Good | High | journal-trip-view.test.ts | — | Covered |
| JournalStopCard UI | ⚠️ Partial | Low | JournalStopCard.test.tsx | 1h | Shallow component test |

**Risk Assessment:**
- **MEDIUM:** Journal storage (data loss risk mid-trip)
- **LOW:** Export (not primary flow)

---

### 7. Adventure Mode

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Adventure service | ✅ Good | High | adventure-service.test.ts | — | Core logic covered |
| Adventure controller hook | ❌ None | 0% | — | 2h | useAdventureModeController untested |

**Risk Assessment:**
- **LOW:** Service well covered
- **MEDIUM:** Hook orchestration untested

---

### 8. Vehicle & Storage

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Vehicles | ✅ Good | High | vehicles.test.ts | — | Covered |
| Vehicle garage | ✅ Good | High | storage-garage.test.ts | — | Covered |
| Budget storage | ✅ Good | High | storage-budget.test.ts | — | Covered |
| Style presets | ✅ Good | High | style-presets.test.ts | — | Covered |
| User profile | ✅ Good | High | user-profile.test.ts | — | Covered |
| URL hydration / share | ✅ Good | High | share-utils.test.ts | — | Covered |

**Risk Assessment:**
- **LOW:** Storage layer well covered

---

### 9. Print System

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Trip print day builder | ✅ Good | High | trip-print-day.test.ts | — | Covered |
| Print builders/cover/formatters | ❌ None | 0% | — | 3h | Cover + formatters untested |

**Risk Assessment:**
- **LOW:** Print not primary flow

---

### 10. Settings Panel (New Feature)

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| Settings panel (all sections) | ❌ None | 0% | — | 2h | MyDefaults, TravelStyle, Privacy |
| CollapsibleSection | ❌ None | 0% | — | 30m | New UI primitive |

**Risk Assessment:**
- **MEDIUM:** Privacy clear-all needs testing
- **LOW:** Settings persistence (covered elsewhere)

---

### 11. UI Components & Hooks

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| useTripCalculation | ❌ None | 0% | — | 4h | 324 lines, largest hook |
| useStep3Controller | ❌ None | 0% | — | 3h | 286 lines, Step 3 orchestration |
| usePOI (map toggle) | 🔥 Critical | 0% | — | 2h | **BROKE IN DEMO** |
| useBudgetController | ✅ Good | High | useBudgetController.test.ts | — | Covered |
| useGhostCar | ✅ Good | High | useGhostCar.test.ts | — | Covered |
| useJournalTimeline | ✅ Good | High | useJournalTimeline.test.tsx | — | Covered |
| usePOISuggestionHelpers | ✅ Good | High | usePOISuggestionHelpers.test.ts | — | Covered |
| All UI components | ❌ None | 0% | — | 10h+ | No rendering tests (Map, Steps, etc) |

**Risk Assessment:**
- **🔥 CRITICAL:** usePOI (broke in demo)
- **HIGH:** useTripCalculation (core calculation hook)
- **MEDIUM:** useStep3Controller (central orchestration)
- **LOW:** UI components (not blocking)

---

### 12. API Layer

| Feature / Module | Status | Coverage | Test File(s) | Effort | Notes |
|------------------|--------|----------|--------------|--------|-------|
| api.ts (OSRM) | ❌ None | 0% | — | 2h | External API wrapper |
| api-geocoding.ts | ❌ None | 0% | — | 1h | Photon geocoding |
| api-routing.ts | ❌ None | 0% | — | 1h | Routing helpers |
| Weather service | ❌ None | 0% | — | 1h | weather.ts |
| Route geocoder | ✅ Good | High | route-geocoder.test.ts | — | Covered |

**Risk Assessment:**
- **MEDIUM:** API mocks (external dependencies)
- **LOW:** Not blocking (failures handled)

---

## 🎯 Recommended Sprint Plan

### Sprint 1: Critical Fixes (1 week, 9h)
**Goal:** Fix demo failures + quick wins

```
P0 Items:
- [ ] poi.ts + usePOI tests (2h)
- [ ] poi-service/ tests (4h)

Quick Wins:
- [ ] regional-costs.ts (30m)
- [ ] discovery-engine.ts (1h)
- [ ] estimate-service.ts (45m)
- [ ] border-avoidance dedicated file (20m)

Total: 8.6h
Coverage gain: ~+8-10%
```

---

### Sprint 2: Core Hooks (1 week, 10h)
**Goal:** Cover main orchestration hooks

```
P1 Items:
- [ ] orchestrateTrip() integration test (6h)
- [ ] useTripCalculation tests (4h)

Total: 10h
Coverage gain: ~+5-7%
```

---

### Sprint 3: Remaining P1 + P2 (1 week, 12h)
**Goal:** Cover remaining high-value items

```
P1 Items:
- [ ] outbound departure optimizer (3h)
- [ ] return departure optimizer (3h)

P2 Items:
- [ ] journal-storage (2h)
- [ ] Settings panel (2h)
- [ ] estimate-service (45m - already done in Sprint 1)

Total: 10h
Coverage gain: ~+4-6%
```

---

### Sprint 4: P3 + UI (if time allows)
**Goal:** Background items + component tests

```
P3 Items:
- [ ] Print pipeline (3h)
- [ ] API layer mocks (4h)

Total: 7h
Coverage gain: ~+3-5%
```

---

## 🎯 Final Target

**After all sprints:**
```
Coverage:  75-85% statements
Test files: 70-80 files
Tests:      900+ assertions
Risk:       All critical paths covered
```

**Definition of Complete:**
- All P0 complete
- All P1 complete
- P2 at 80%+ complete
- No critical user flow untested
- Coverage ≥ 75%

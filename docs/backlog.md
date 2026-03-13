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

## Step UX — Collapsible Sections ("Smart Defaults + Accordion")
*Noted: Mar 12 2026*

**Problem:** Each step is too busy. Steps 1 and 2 currently render everything open at once,
giving every field equal visual weight. Most users only touch 2–3 fields per step — the
rest are sensible defaults they never change. Showing all of them open treats optional
fine-tuning as mandatory, making the step feel overwhelming.

**Rejected approach:** Strict progressive unlock (section B gated behind section A).
Too frustrating for users who already know what they want. A user changing max drive
hours shouldn't have to "complete" vehicle selection first.

**Proposed approach: smart defaults + accordion**

- **Always expanded:** The 2–3 required or high-priority fields.
- **Collapsed with a summary chip:** Everything with a sensible default — summary
  visible in the header, full controls revealed on click.

### Step 1 structure

| Section | State | Summary chip example |
|---|---|---|
| Date range + time toggle | Always open | — |
| Location list | Always open | — |
| Daily Arrival Target | Collapsed | `"Arrive by 9 PM"` |
| Auto/Manual + day-at-destination | Collapsed | `"🔄 Auto · 2h at destination"` |
| Adventure / Challenges / Template | Collapsed or secondary action row | — |

### Step 2 structure

| Section | State | Summary chip example |
|---|---|---|
| Vehicle | Always open | — |
| Quick presets | Always open (compact) | — |
| Travelers | Collapsed | `"4 travelers · 2 drivers"` |
| Accommodation | Collapsed | `"1 room · $150/night"` |
| Driving prefs | Collapsed | `"8h max · balanced stops"` |
| Trip style / preset | Collapsed | `"Classic"` |

### Implementation plan

1. **`<CollapsibleSection>` component** in `src/components/UI/`
   - Props: `title`, `icon`, `summary` (string shown when collapsed), `defaultOpen?`
   - Animate open/close with a simple CSS transition (no extra libraries)
   - Chevron rotates on toggle

2. **Wrap Step 2 first** — lower risk, more sections, bigger visual gain
3. **Then Step 1** — daily arrival target + route mode collapsed by default

### Key design rule
The summary chip must be meaningful — it should answer "what is this currently set to?"
not just label the section. A user scanning a collapsed accordion should be able to
confirm their defaults without opening anything.

---

## Settings Panel — Dedicated User Preferences
*Noted: Mar 12 2026*

**Context:** `src/components/Settings/` exists but is empty. The codebase already has
significant infrastructure for user preferences that has no UI surface — it operates
silently or is buried inside the wizard steps. A dedicated Settings panel collects all
of this into one discoverable place, separate from the trip flow.

**Location:** Settings lives *outside* the wizard (not a Step). Think persistent
profile layer — accessible from a gear icon or nav item at any time.

---

### Section 1: My Defaults
*Pre-fills every new trip automatically.*

- **Home city** — `getLastOrigin()` already tracks this; never surfaced
- **Crew** — named traveler list with driver flags (`driverNames` already in `TripSettings`)
- **Default travelers / drivers count**
- **Preferred units** — km / mi (currently in Step 2, rarely changed)
- **Currency** — CAD / USD (same)

---

### Section 2: My Travel Style
*Your travel personality — sets tone for budget splits and hotel defaults.*

**Hotel tier picker** (`HotelTier = 'budget' | 'regular' | 'premium'` — type exists, no UI):
```
🏕 Budget      🏨 Regular      ✨ Premium
 ~$80/night     ~$150/night     ~$250/night
```
Selecting a tier auto-suggests a `hotelPricePerNight` value.

**Budget profile** (`BudgetProfile = 'balanced' | 'foodie' | 'scenic' | 'custom'` — used
internally for weight allocation, but only reachable buried in Step 3):
```
⚖️ Balanced    🍜 Foodie    🏔 Scenic    🔧 Custom
```
Profile controls how budget splits between gas / hotel / food / misc when in fixed mode.

**Style preset** (`StylePreset` with shareable URL already built) — your named hotel+meal
snapshot. Settings is the natural home to create, name, and share presets.

---

### Section 3: My Budget Profiles
*Named, saveable budget configurations.*

Full storage layer already exists (`getBudgetProfiles`, `saveBudgetProfile`,
`setDefaultBudgetProfile`, `removeBudgetProfile`) — zero UI built yet.

- Save current budget as a named profile (e.g. "Family Summer", "Solo Blitz")
- Set a profile as default — loads automatically on new trips
- Delete profiles

---

### Section 4: My Garage
*Default vehicle selection.*

Already functional in storage (`getDefaultVehicleId`, `setDefaultVehicleId`).
Settings surfaces what the garage already knows.

---

### Section 5: Adaptive Suggestions
*Based on your trip history — already computing silently.*

`user-profile.ts` tracks hotel/meal averages across up to 10 past trips with
recency-weighted decay. Never shown to the user anywhere.

- Show: *"Based on your last 4 trips, your hotel average is $162/night"*
- Button: "Use this as my default" / "Reset to baseline"
- Threshold: only shown when `tripCount >= ADAPTIVE_CONFIDENCE_THRESHOLD` (3 trips)

---

### Section 6: Privacy & Data
*Full control over what's stored locally.*

- **Include starting location in shared templates** — currently buried in Step 1, belongs here
- **Trip history** — view count, "Clear history" button
- **Adaptive profile** — "Reset to Chicharon's Classic baseline"
- **All local data** — nuclear "Clear everything" with confirmation
- Note: *All data stays on your device. Nothing is sent to a server.*

---

### Architecture notes

- **Panel type:** Drawer or dedicated route — not a wizard step
- **Persistence:** All settings write to `localStorage` via existing storage layer
- **No new storage primitives needed** — infrastructure is already there
- **`src/components/Settings/`** is the right home, already exists (empty)
- Suggested files:
  - `SettingsPanel.tsx` — orchestrator, section layout
  - `MyDefaultsSection.tsx`
  - `TravelStyleSection.tsx`
  - `BudgetProfilesSection.tsx`
  - `PrivacySection.tsx`

### Section 7: About & Credits
*Open-source attribution — required by ToS for OSRM, Photon, Nominatim, Overpass, Open-Meteo.*

A collapsible "Powered by" section at the bottom of Settings (or a dedicated modal).
Landing footer already has a compact one-liner — Settings can have the full version.

| Service | Used for | Link |
|---|---|---|
| OSRM | Route calculation | project-osrm.org |
| Photon (komoot) | Location search (primary) | photon.komoot.io |
| Nominatim / OpenStreetMap | Location search (fallback) + reverse geocode | openstreetmap.org/copyright |
| Overpass API | POI discovery | overpass-api.de |
| Open-Meteo | Weather data | open-meteo.com |
| CARTO | Street map tiles | carto.com/attributions |
| OpenTopoMap | Terrain map tiles | opentopomap.org |
| Esri | Satellite map tiles | already attributed in Leaflet control |

**Leaflet tile attribution** (bottom-right map control) — all three tile layers already
have correct attribution strings in `map-constants.ts`. No action needed there.

**Landing footer** — compact one-liner already added to `LandingFooter.tsx`:
OSRM · Photon · OpenStreetMap · Open-Meteo · CARTO

---

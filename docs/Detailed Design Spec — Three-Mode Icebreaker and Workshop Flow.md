# Detailed Design Spec — Three-Mode Icebreaker & Workshop Flow

**Date:** March 16, 2026
**Status:** Whiteboard → Spec
**Origin:** Aaron + ZeeRah design session
**Replaces:** "Detailed Design Spec — Phase 1 Icebreaker and Phase 2 Workshop.md" (Plan-only draft)

---

## The Architecture

Three modes. Three entry experiences. One destination.

```
PLAN MODE                    ADVENTURE MODE               ESTIMATE MODE
"Build My MEE Time"          "Find My MEE Time"           "What's My MEE Worth?"

Phase 1: Icebreaker          Phase 1: Icebreaker          Phase 1: Icebreaker
Where / When / Who           What are you working with?   Where / Who
        ↓                            ↓                            ↓
Phase 2: Workshop            Phase 2: Workshop            Phase 2: Workshop
Build Your MEE Time          Discover Your MEE Time       Price Your MEE Time
        ↓                            ↓                            ↓
Phase 3: The Reveal          "Ready to make it real?"     "Numbers work?"
Commit here                  → Hands off to Plan Mode     → Hands off to Plan Mode
```

**Plan Mode is the destination.** Adventure and Estimate are discovery paths — on-ramps to the same highway. When a user commits in either mode, MEE carries the context forward into Plan Mode invisibly. No re-entering data. No starting over. The conversation continues.

---

## Shared Icebreaker Principles

These apply to all three modes:

- **One question = full screen attention.** No competing fields, no visible progress bar, no wizard language.
- **The map is constant.** Visible throughout Phase 1 as the world the trip lives in. Not a thumbnail. Not a widget. The primary surface.
- **Fade transitions between questions.** Each question fades out, the next fades in. Pacing is part of the experience.
- **The escape hatch is always visible.** A subtle "Switch to full planner" on every question. One tap, existing layout, pre-filled with whatever has been entered. Power users are never trapped.
- **Copy is the first design tool.** The question text does more design work than any visual treatment. Hold it.

---

## PLAN MODE

### Phase 1 — The Icebreaker

**Purpose:** MEE meets the trip. Minimal, intentional, map-forward.

---

**Question 1**
```
Where is your MEE time?
```
- Full screen map, search input floated over it
- Origin typed → pin drops, map centers
- Destination typed → second pin drops, eager route preview polyline draws immediately
- Subtle "Add a stop along the way" after both pins are set — optional, not prominent. **One intermediate stop max in the icebreaker.** More complex routing is a "full planner" case — the escape hatch handles it.
- Advance: Enter or forward arrow after destination set

---

**Question 2**
```
When is your MEE time?
```
- Date range picker floated over map (pins + route still visible as context)
- Departure time beneath dates
- Tooltip near origin pin: *"Leaving from here"*
- Tooltip near destination pin: *"Arriving here"*
- Advance: when dates are selected

---

**Question 3**
```
Who's coming?
```
- Travelers (stepper)
- Drivers (stepper, capped at travelers)
- Clean, minimal — no form feel
- Advance: "Let's build this →"

---

### Phase 2 — Build Your MEE Time

**Header:** `Let's build your MEE time.`

**The live reflection bar** — persistent, always visible:
```
~$847 estimated  ·  2 days  ·  14h driving
[Budget distribution bar]
```
Every control change updates this immediately (debounced ~300ms for cost calculations).

**Controls:**

| Control | Behavior |
|---------|----------|
| Vehicle type | Quick-select preset cards → fuel cost updates live |
| Hotel tier | Budget / Regular / Premium → overnight cost updates live |
| Travelers / Drivers | Steppers → cost per person + rotation updates live |
| Rooms needed | Auto-calculated, adjustable, hidden on day trips |
| Stop frequency | Conservative / Balanced / Aggressive → drive time updates live |
| Max hours/day | Slider → day count updates live |
| Budget mode toggle | Off by default. On → budget input + remaining tracker appear |

**More options** (collapsible, not prominent):
Scenic mode, border avoidance, toll avoidance, named drivers, trip style presets, custom budget profiles.

**The commit moment:**
```
[ Calculate my MEE time ]
```

---

### Phase 3 — The Reveal

Already exists. Cinematic, layered, three-phase stagger. No changes needed.

---

## ADVENTURE MODE

### Phase 1 — The Icebreaker

**Purpose:** MEE learns what the user has to work with. Destination unknown — that's the point.

---

**Question 1**
```
What are you working with?
```
- Two steppers side by side: **Days** and **Budget ($)**
- As budget increases, the map shows an **expanding radius** from the user's origin — *"You can reach here."*
- The radius is the Adventure magic moment. Watching reach grow as budget goes up.
- **The circle is context. The destination pins are the payoff.** As the radius grows, destination pins appear on the map — places that just became reachable. The pins animate in (fade + scale). Pulling budget back makes pins disappear. The map is literally showing what's possible.
- Origin is pulled from last known location or prompted subtly: *"Starting from [city]? →"*
- Advance: when both days and budget are set

*Note: Radius map visualization is new — does not exist yet. This is the centerpiece of Adventure Phase 1. Leaflet circle overlay for the radius + animated pin layer for destinations.*

---

**Question 2**
```
Who's coming?
```
- Travelers (stepper)
- Accommodation tier: 🏕 Budget · 🏨 Regular · ✨ Premium
- Round trip toggle
- Advance: "Find my adventure →"

---

### Phase 2 — Discover Your MEE Time

**Header:** `Here's where your MEE time can take you.`

**The surface:** Existing curated destination cards — already built, already populated with 30+ destinations. The Phase 2 wrapper gives them a proper home and presentation.

**What's new in the presentation:**
- Map shows destination pins at the right reach distance from origin — not a list, a visual spread
- Destination cards show: name, category emoji, estimated cost vs budget, drive time, tags
- **Tight budget badge** (orange) on destinations in the 100–115% buffer zone — visible but not hidden
- Filter bar: 🌿 Scenic · 👨‍👩‍👧‍👦 Family · 💸 Budget · 🍴 Foodie
- Challenges section beneath destinations (already exists in AdventureResultsPanel)

**Selecting a destination:**

The card expands or a confirmation surface appears:
```
Banff, Alberta
3 days · ~$1,240 estimated · 14h driving

[ Make it real → ]
```

**The handoff moment:**
```
Found it. Ready to make it real?
[ Build this trip in Plan Mode ]
```

MEE pre-fills Plan Mode with:
- Origin (from Adventure Phase 1)
- Destination (selected)
- Date range (from days count + departure date)
- Travelers, drivers, accommodation tier (from Adventure Phase 1)

Plan Mode opens at Phase 2 (Build Your MEE Time) — not Phase 1. The icebreaker is done. The conversation continues.

---

## ESTIMATE MODE

### Phase 1 — The Icebreaker

**Purpose:** Route is already decided. MEE just needs to know where and who.

Two questions only — Estimate users know what they want, don't make them wait.

---

**Question 1**
```
Where are you headed?
```
- Same map + pin drop flow as Plan Mode Question 1
- Origin + destination, eager route preview
- Advance: when both are set

---

**Question 2**
```
Who's making the trip?
```
- Travelers (stepper)
- Vehicle type (quick-select preset cards)
- These two move the cost estimate most — everything else is tunable in Phase 2
- **Optional: departure date** — light date input, not required. If skipped, Plan Mode defaults to today + estimated trip duration on handoff.
- Advance: "Price this trip →"

---

### Phase 2 — Price Your MEE Time

**Header:** `Here's what your MEE time is worth.`

**The live cost surface** — the centerpiece:

```
              LOW        MID        HIGH
Fuel          $87        $102       $122
Hotel         $180       $280       $440
Food          $120       $200       $320
Misc          $40        $100       $200
─────────────────────────────────────────
Total         $427       $682       $1,082
Per person    $107       $170       $271
```

Every row updates live as the user tunes.

**Tunable variables:**
- Hotel tier (Budget / Regular / Premium) → hotel row updates
- Nights (auto-calculated, adjustable) → hotel row updates
- Gas price (input) → fuel row updates
- Travelers → per-person row updates, food + misc update
- Rooms → hotel row updates

**The infrastructure is already built.** `estimate-service.ts` produces `TripEstimate` with `low/mid/high` per category. This surface is surfacing it live rather than on-demand.

**The handoff moment:**
```
Numbers look good. Want the full plan?
[ Build this trip in Plan Mode ]
```

MEE pre-fills Plan Mode with:
- Origin + destination (from Estimate Phase 1)
- Vehicle (from Estimate Phase 1)
- Travelers (from Estimate Phase 1)
- Hotel tier (from Estimate Phase 2 tuning)

Plan Mode opens at Phase 2 (Build Your MEE Time) — icebreaker skipped, context carried.

---

## The Handoff Contract

When Adventure or Estimate hands off to Plan Mode, these fields must carry:

| Field | Adventure | Estimate |
|-------|-----------|----------|
| Origin | ✅ from Phase 1 | ✅ from Phase 1 |
| Destination | ✅ selected destination | ✅ from Phase 1 |
| Date range | ✅ computed from days | ⬜ optional in Phase 1 — defaults to today + trip duration if not entered |
| Travelers | ✅ from Phase 1 | ✅ from Phase 1 |
| Drivers | ✅ from Phase 1 | ⬜ defaults to 1 |
| Vehicle | ⬜ defaults to sedan | ✅ from Phase 1 |
| Hotel tier | ✅ from Phase 1 | ✅ from Phase 2 |

Plan Mode opens at **Phase 2** when receiving a handoff. The icebreaker is already done.

---

## What's New vs What Exists

| Element | Status |
|---------|--------|
| Plan Phase 1 conversational flow | 🆕 New — `IcebreakerFlow.tsx` or similar |
| Plan Phase 2 live reflection bar | 🆕 New presentation layer (engine exists) |
| Adventure Phase 1 conversational flow | 🆕 New wrapper around existing inputs |
| Adventure radius map visualization | 🆕 New — centerpiece of Adventure Phase 1 |
| Adventure Phase 2 destination cards | ✅ Exists — `AdventureResultsPanel.tsx` |
| Adventure handoff to Plan | ✅ Exists — `onAdventureComplete` already wires this |
| Estimate Phase 1 conversational flow | 🆕 New wrapper |
| Estimate Phase 2 live cost table | 🆕 New presentation layer (`estimate-service.ts` exists) |
| Estimate handoff to Plan | 🆕 New — needs wiring |
| Escape hatch (switch to full planner) | 🆕 New on all three |
| Fade transitions between questions | 🆕 New |

---

## Decided

**Entry experience preference** — Settings → My Defaults → Entry Experience:

```text
○ Conversational  "Walk me through it"  ← default for new users
● Classic         "Jump straight to the planner"
```

New users with no preference set always get the icebreaker. Power users flip it once and never see it again. The escape hatch inside any icebreaker offers *"Always use classic →"* as a one-tap preference save — discoverable at exactly the right moment.

**Classic wizard is permanent.** It's not going away — it's the escape hatch from every icebreaker and the destination for users who prefer it. Landing screen surfaces it directly for classic-preference users.

**Full `orchestrateTrip()` is too heavy for Phase 2 live reflection.** Use `estimate-service.ts` for the live bar — it's already built for this. Full orchestration fires only on the final "Calculate my MEE time" commit.

**Mobile layout** — Map visible as ~45% of screen. Input card as a bottom sheet (slides up from bottom). Framer Motion is already in the bundle. This matches the standard pattern for map-forward mobile UIs and avoids covering the map entirely.

---

## Open Questions for Kitchen

1. Does the Icebreaker live as a full-screen overlay on top of the existing layout, or does it replace the sidebar entirely during Phase 1?
2. Debounce timing for live reflection — 300ms for estimate-service calls, instant for simple steppers (traveler count, etc.)?
3. Adventure radius — does the expanding radius also update destination card ordering in Phase 2, or is that list static once the user advances?

---

## Design Principles to Hold

**The map is not a widget.** It's the world the trip lives in. Visible throughout Phase 1. Responsive to inputs. The radius visualization in Adventure is the map *talking back.*

**Handoffs are invisible.** When Adventure or Estimate sends the user to Plan, it should feel like continuing the same conversation — not switching apps.

**Live reflection is the experience.** Phase 2's value is watching the trip respond. If a change doesn't update immediately, the experience breaks.

**The escape hatch must be easy.** Never trap a user in the ceremony.

**Copy holds the personality.** "Where is your MEE time?" · "What are you working with?" · "Let's build your MEE time." · "Found it. Ready to make it real?" — these lines are load-bearing. Don't genericize them.

---

💚 My Experience Engine — Built by Aaron "Chicharon" with the UV7 crew

# Detailed Design Spec — The Four-Beat Arc
## Tell MEE · Sketch · Personal · Voilà

**Date:** March 18, 2026
**Status:** ✅ Refined — Ready to Cook
**Origin:** Aaron + ZeeRah + Tori synthesis — refined at work between cars
**Replaces:** "Gathering, Presenting, Collaborating" spec (same session, tighter framing)
**Refinement pass:** DiZee — March 18, 2026

---

## The Arc

```
BEAT 1 — Tell MEE about this trip
  The Icebreaker
  One question at a time. Map alive. DNA strand building.
  MEE is listening.

        ↓

BEAT 2 — Let MEE sketch this out
  Basic Calculation
  Fast, lightweight. Show the rough shape immediately.
  Route drawn. Numbers on screen. MEE is responding.

        ↓

BEAT 3 — Let MEE make this personal
  The Workshop
  Tune it. Watch it respond. Make it yours.
  MEE knows what you want now.

        ↓

BEAT 4 — Here's your MEE time
  The Reveal
  MEE presents the finished trip.
  Cinematic. Earned. Voilà.
```

Every beat has MEE's voice. Every beat earns the next one. MEE is doing something at each stage — listening, sketching, personalizing, presenting.

---

## Why This Is Tighter Than The Previous Version

The original three-mode arc (Gathering → Presenting → Collaborating) was correct but skipped a critical step: the user was tuning blind. They saw nothing before Calculate fired. The workshop had no reference point.

**Basic Calc fixes this.** Show the rough shape immediately after the icebreaker. Route drawn. Ballpark numbers. Not the final answer — the sketch. Now the workshop is tuning something visible, not configuring in the dark.

This also means the Reveal earns its drama. Currently the reveal is the *first* time the user sees anything — so it can't be fully cinematic because it's also doing the job of "showing you the route for the first time." With Basic Calc as Beat 2, the Reveal is showing them the *refined* trip. The difference between a rough sketch and the finished version. That gap is where the voilà lives.

---

## BEAT 1 — Tell MEE about this trip

**What it is:** The existing icebreaker. No changes to the current implementation.

Three questions. One at a time. Map full screen. DNA strand building as they answer.

```
Where is your MEE time?
When is your MEE time?
Who's coming?
```

**Exits to Beat 2** when the user taps "Let's build this →"

---

## BEAT 2 — Let MEE sketch this out

**What it is:** A fast, lightweight calculation that runs immediately after the icebreaker completes. Not the full orchestration — a sketch.

**The surface:** The map stays full screen. The DNA strand fades. The route polyline draws in — `AnimatedPolyline` already handles this. Over the map, a compact glass card floats:

```
┌────────────────────────────────────┐
│  Let MEE sketch this out           │
│                                    │
│  Winnipeg → Vancouver              │
│  ~1,847 km  ·  3 days  ·  ~$940   │
│                                    │
│  [  Make it personal →  ]          │
│                                    │
│  Looks wrong? Adjust route →       │
└────────────────────────────────────┘
```

**What the sketch shows:**
- Route drawn on map (real OSRM call — same as eager route preview, already available)
- Distance (from route calculation)
- Days (from icebreaker dates)
- Estimated cost (from `generateEstimate()` — pure math, instant, no extra API call)

**What the sketch does NOT show:**
- Stop breakdown
- Hotel/fuel/food split
- Feasibility rating
- Itinerary
- Any detail that requires full orchestration

This is the outline. Not the painting.

**The card copy:** "Let MEE sketch this out" as the heading. Below the numbers, a single sentence from `buildResultsFramingLine(tripMode)` — MEE's voice framing what it just did.

**Three exits:**
- "Make it personal →" → advances to Beat 3
- "Calculate with defaults →" (small secondary link) → skips Beat 3, fires `orchestrateTrip()` immediately with current defaults. For users who don't need to tune.
- "Looks wrong? Adjust route →" → opens the classic wizard at Step 1 (escape hatch)

**Implementation note:** The route calculation already fired during the icebreaker (eager route preview). Beat 2 reuses those results. `generateEstimate()` takes the summary + vehicle + settings — pure math, already built. Beat 2 might cost zero additional API calls.

---

## BEAT 3 — Let MEE make this personal

**What it is:** The workshop. Tune the sketch into a real plan.

**The surface:** The map stays visible. The sketch card dismisses. A workshop panel floats over the map — same glass aesthetic, slightly wider.

**Header:** `Let MEE make this personal`

**The Live Reflection Bar** — persistent at the top of the workshop, always visible:
```
~$940 estimated  ·  3 days  ·  18h driving
[Budget distribution bar — fuel / hotel / food / misc]
```

Updates immediately on every control change. The user watches the trip respond.

**The controls — progressive disclosure:**

Primary controls (always visible — highest impact on numbers):

```text
Your ride
[ 🚗 Sedan ] [ 🚙 SUV ] [ 🛻 Truck ] [ 🚐 Van ] [ ⚡ Hybrid ]

Hotel vibe
[ 🏕 Budget ~$90 ] [ 🏨 Regular ~$140 ] [ ✨ Premium ~$220 ]
```

Secondary controls (behind "More options ↓" expand):

```text
Pace
[ 🐢 Relaxed ] [ ⚖️ Balanced ] [ 🚀 Push it ]

Budget
[ No budget set ] ←toggle→ [ $______ ]
```

Default state: secondary controls collapsed. Users who want them tap to expand — the Live Reflection Bar still updates live either way. Keeps the workshop feeling like 2 decisions, not 4.

Each control tap updates the Live Reflection Bar instantly. No Calculate button here — the numbers update live from `generateEstimate()`. Pure math. Instant.

**The commit moment — bottom of workshop:**
```
[ Calculate my MEE time → ]
```

This fires the full `orchestrateTrip()` — real simulation, real fuel stops, real feasibility analysis. The full plan.

**"See all settings →"** — below the commit button. Opens classic wizard Step 2. Always available.

---

## BEAT 4 — Here's your MEE time

**What it is:** The voilà. MEE presents the finished trip.

**The building state** — while `orchestrateTrip()` runs:

Map stays full screen. Workshop panel dismisses. Centered over the map:

```
             ✦

  Building your MEE time...

  Routing through Calgary…
  [rotates every 900ms via useCalculationMessages]
```

`useCalculationMessages` already produces location-aware rotating lines. This is just the right stage for them.

**The reveal sequence** — when calculation completes:

1. Building state fades (200ms)
2. Map dims to 70% opacity (300ms)
3. `TripSignatureCard` blooms full-screen, centered over the map
4. Beneath the card: *"Here's your MEE time."* in Cormorant Garamond
5. Hold ~1.5 seconds (interruptible — tap anywhere)
6. Sidebar slides in from right, map returns to full opacity
7. Step 3 loads with existing `useRevealAnimation` stagger (0 / 150 / 280ms layers)

**Emotional target:** The user has seen the sketch. They've made it personal. Now MEE is showing them what became of all of that. This is the payoff that was earned by Beats 1–3.

---

## The Tune Panel (Collaborating After Reveal)

After the reveal, Step 3 is the collaborative space. One new surface inside it:

Between the health section and the commit card, a compact panel for icebreaker users:

```
Tune this trip

[ 🐢 More relaxed ]   [ 🚀 Push harder ]
[ 🏨 Upgrade hotels ] [ 💸 Save on hotels ]
[ 🌿 More scenic ]    [ ⚡ Fastest route ]
```

One-tap adjustments. Each fires a preset change + recalculation. LiveReflectionBar updates immediately.

`buildTuneOptions(settings, summary)` — pure function, returns only contextually valid options. No "upgrade hotels" if already premium. No "push harder" if already at max drive hours.

**Copy change in ConfirmTripCard** (icebreaker users only):
- "Ready to go?" → no heading needed, the reveal said it
- "Confirm Trip" → "Lock it in"
- Subline from `buildConfirmSubline(tripMode)` stays

---

## What's New vs What Exists

| Element | Status | Notes |
|---------|--------|-------|
| Beat 1 — Icebreaker | ✅ Exists | No changes |
| Beat 2 — Sketch card | 🆕 New | `SketchCard.tsx` — reuses eager route + `generateEstimate()`. Three exits: Make it personal / Calculate with defaults / Adjust route |
| Beat 3 — Workshop panel | 🆕 New | `WorkshopPanel.tsx` — progressive disclosure: vehicle + hotel primary, pace + budget behind "More options ↓" expand |
| `useFourBeatArc` hook | 🆕 New | Beat state machine (`beat: 1\|2\|3\|4`, `isBuilding`, `isRevealing`) — keeps App.tsx thin |
| Beat 4 — Building state | 🆕 New surface | Full-screen `useCalculationMessages` over map |
| Beat 4 — Voilà moment | 🆕 New | Full-screen `TripSignatureCard` bloom before sidebar |
| Tune panel | 🆕 New | `TunePanel.tsx` + `buildTuneOptions()` in `src/lib/` |
| `buildTuneOptions()` | 🆕 New | Pure function, test required |
| Copy changes in Step 3 | 🆕 Minor | Conditional on `icebreakerOrigin` flag |
| LiveReflectionBar | ✅ Exists | Already built, reused in Beat 3 |
| `generateEstimate()` | ✅ Exists | Powers Beat 2 numbers and Beat 3 live updates |
| `useCalculationMessages` | ✅ Exists | Powers Beat 4 building state |
| `TripSignatureCard` | ✅ Exists | Powers Beat 4 voilà moment |
| `useRevealAnimation` | ✅ Exists | Powers Step 3 layer stagger |
| `AnimatedPolyline` | ✅ Exists | Powers route draw in Beat 2 |
| Classic wizard | ✅ Exists | Escape hatch at every beat |

---

## The Escape Hatch — Always One Tap Away

| Beat | Escape |
|------|--------|
| Beat 1 | "Skip to full planner →" on every icebreaker question |
| Beat 2 | "Calculate with defaults →" skips Beat 3 entirely. "Looks wrong? Adjust route →" → classic wizard Step 1 |
| Beat 3 | "See all settings →" → classic wizard Step 2 |
| Beat 4 | Tap anywhere during voilà hold to skip to sidebar |
| After reveal | "See all settings →" in Tune panel |

---

## Resolved Questions (DiZee refinement pass — Mar 18, 2026)

1. ✅ **Beat 2 sketch card — mobile layout:** Bottom sheet on mobile, centered float on desktop. Keeps route visible, thumb-zone friendly.
2. ✅ **Beat 3 workshop dismiss:** Dismisses as Calculate fires — simultaneous with building state appearing. No ambiguity about whether the user committed.
3. ✅ **`icebreakerOrigin` flag — storage:** TripContext. Not App.tsx props (rule: no new props), not Zustand (no new store). Trip-scoped metadata flag, accessible anywhere in Step 3 without drilling.
4. ✅ **Tune panel recalculation:** `generateEstimate()` for pace/hotel/budget. `orchestrateTrip()` only for scenic/fastest route toggle (changes the actual polyline). Keep the panel feeling instant.
5. ✅ **Mobile Beat 4:** Same sequence, adjusted timing — hold reduced 1.5s → 0.8s on portrait, skip map opacity animation. Drama is in the card, not the background transition.

---

## Design Principles to Hold

**Every beat earns the next.** The sketch shows something real. The workshop tunes something visible. The reveal presents something personal. No beat is waiting — each one does work.

**MEE has a voice at every stage.** "Let MEE sketch this out." "Let MEE make this personal." "Here's your MEE time." The copy is the personality. Hold it.

**The reveal earns its drama because of Beat 2.** The user has seen the rough version. The reveal shows them the refined version. That gap is where the voilà lives. Without Beat 2, the reveal is just the first calculation. With it, the reveal is the *difference*.

**`generateEstimate()` is the engine of Beats 2 and 3.** Pure math, instant, no API. The workshop feels live because it literally is — no waiting, no loading state, just numbers responding.

**The classic wizard is never gone.** It's one tap away at every beat. That's what makes the premium path feel safe to inhabit.

---

💚 My Experience Engine — Built by Aaron "Chicharon" with the UV7 crew
*The copy: "Tell MEE about this trip / Let MEE sketch this out / Let MEE make this personal / Here's your MEE time." — Aaron, between cars, March 18 2026.*

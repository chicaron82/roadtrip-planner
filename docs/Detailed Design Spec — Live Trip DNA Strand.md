# Detailed Design Spec — Live Trip DNA Strand

**Date:** March 16, 2026
**Status:** Whiteboard → Spec
**Origin:** Aaron + ZeeRah design session
**Depends on:** Three-Mode Icebreaker and Workshop Flow spec
**Ticket order:** After icebreaker is wired. Standalone component, no conflicts.

---

## The Idea

As the user answers icebreaker questions, a route line animates in and builds itself — nodes appearing, spacing proportionally to real drive data, day splits marking where the engine would break the journey.

It's not a map. It's not a route preview. It's the **shape of the trip** assembling itself in real time as the user commits to answers.

When they confirm and the real map loads — the strand has already made the trip feel real. The map is the truth. The strand was the promise.

---

## What It Is (And Isn't)

**Is:** A pure UI component. Pure math. Zero API calls. No Leaflet involvement.

**Isn't:** A map. Not a routing preview. Not a simulation output. Not precise.

The strand shows shape, not truth. Fuel stop count is a ballpark. Day split positions are estimated. Node spacing is proportional, not GPS-accurate. That's correct — precision comes with the real map reveal. The strand's job is emotional momentum, not data fidelity.

---

## Placement — Option A

**Below the icebreaker question, above the fold.**

```
┌─────────────────────────────────────┐
│  [Map — full screen background]     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Where is your MEE time?      │  │  ← Floating question
│  │  [input]                      │  │
│  └───────────────────────────────┘  │
│                                     │
│  ●————————————————————————————●     │  ← DNA Strand
│                                     │
└─────────────────────────────────────┘
```

Three clear layers:
1. Map — behind everything, passive
2. Strand — builds as questions are answered
3. Question — floated on top, primary focus

No Leaflet involvement. No map API calls for the strand. The map exists independently — the strand draws over it in a separate DOM layer.

---

## Mobile — Vertical Swap

Portrait orientation → strand rotates to vertical. Nodes stack top to bottom. Natural reading direction for a phone.

```
        ●   ← Origin node
        │
        │
      ⛽ │   ← Fuel stop node
        │
       ━━━  ← Day split band
        │
      ⛽ │
        │
        ●   ← Destination node
```

Day splits become horizontal bands across the vertical line — visual "chapters" of the drive.

Detection: `window.innerWidth < 768` or a `useMediaQuery` hook if one already exists in the codebase.

---

## Build Sequence — What Appears When

### On landing (before any answer)
Nothing. The strand doesn't exist yet.

### When Plan Mode is selected from landing
The route line animates in — left to right on desktop, top to bottom on mobile. Empty. No nodes. Just the line.

```
●————————————————————————————————————●
```

Duration: ~600ms ease-out. This is the opening beat — *something is about to exist.*

### After "Where?" is answered (origin + destination set)
Two nodes appear — origin (left/top) and destination (right/bottom).

```
● ———————————————————————————————————●
[City A]                        [City B]
```

City names label each node. If the eager route preview has fired, use the real distance for spacing calculations from this point forward.

### After "When?" is answered (dates set)
Day count is now known. Day split markers appear — subtle vertical tick marks (desktop) or horizontal bands (mobile) dividing the line proportionally.

```
●——————————|——————————|——————————————●
[City A]  Day 2     Day 3      [City B]
```

Spacing: `totalDistanceKm / numDays` per segment. Equal splits for now — the real simulation will refine this later.

### After "Who?" is answered (travelers + drivers set)
Estimated fuel stop nodes populate along the line.

```
●———⛽———⛽——|———⛽———⛽——|———⛽——————————●
```

**Fuel stop estimation (pure math, no API):**
```
estimatedStops = Math.floor(totalDistanceKm / (tankRangeKm * 0.85))
```
- `tankRangeKm`: derived from vehicle type selection if available, otherwise default 500km (sedan baseline)
- `0.85`: comfort factor — stops before empty, not at empty
- Positions: evenly distributed within each day segment

This is a ballpark. The real simulation will place stops at actual highway cities. The strand is showing *roughly how many times you'll stop* — not where.

### Vehicle type selected (Phase 2)
If vehicle type changes in Phase 2 workshop, fuel stop count recalculates and nodes reposition smoothly.

---

## Node Types & Visual Design

Match MEE's existing dark premium aesthetic. Cream on dark. Warm amber accent.

| Node | Shape | Color | Label |
|------|-------|-------|-------|
| Origin | Filled circle, larger | Amber `#fbbf24` | City name |
| Destination | Filled circle, larger | Amber `#fbbf24` | City name |
| Fuel stop | Small diamond or circle | Cream `rgba(245,240,232,0.5)` | None (or ⛽ at larger sizes) |
| Day split | Tick mark + subtle band | Cream `rgba(245,240,232,0.15)` | "Day 2", "Day 3" |

**The line itself:**
```css
background: linear-gradient(
  to right,
  rgba(251, 191, 36, 0.8),   /* amber at origin */
  rgba(245, 240, 232, 0.3),  /* cream mid-route */
  rgba(251, 191, 36, 0.8)    /* amber at destination */
);
height: 2px;
```

**Node animations:**
- Line draw: CSS width transition, left to right
- Node appear: scale(0) → scale(1), 200ms ease-out, slight bounce
- Day splits: fade in, 300ms
- Fuel stops: staggered fade in, 100ms between each

---

## The Reveal Transition

When the user confirms and the real map loads:

1. Strand fades out — 400ms
2. Map animates in — existing cinematic reveal takes over
3. The actual route polyline draws on the map

The strand was the promise. The map is the truth. The transition is the handoff.

No need to reconcile strand node positions with real map positions — they're separate layers, separate moments. The strand disappears completely before the map takes over.

---

## Component Architecture

**New component:** `TripDNAStrand.tsx` in `src/components/UI/` or `src/components/Landing/`

**Props:**
```ts
interface TripDNAStrandProps {
  phase: 0 | 1 | 2 | 3;          // which icebreaker questions answered
  originName?: string;             // city name for origin node
  destinationName?: string;        // city name for destination node
  totalDistanceKm?: number;        // from eager route preview
  numDays?: number;                // from date range
  vehicleRangeKm?: number;         // from vehicle selection, default 500
  orientation?: 'horizontal' | 'vertical';  // desktop vs mobile
}
```

**Phase drives what's visible:**
```
phase 0 → nothing
phase 1 → line only (mode selected)
phase 2 → line + origin/destination nodes (where answered)
phase 3 → + day splits (when answered)
phase 4 → + fuel stop nodes (who answered)
```

**Pure component.** No store reads. No API calls. Everything passed as props from the icebreaker flow. Parent derives the props from existing state — `totalDistanceKm` from eager route preview result, `numDays` from date calculation, `vehicleRangeKm` from vehicle preset selection.

---

## What This Doesn't Need

- No OSRM calls
- No Overpass calls
- No Leaflet
- No new store state
- No new hooks
- No map involvement of any kind

Everything it needs is either passed as props or calculated inline with arithmetic.

---

## Adventure + Estimate Modes

**Adventure:** The strand appears after destination is selected in Phase 2. At that point origin and destination are both known. Same component, same behavior — just triggered later in the flow.

**Estimate:** Same as Plan. Origin and destination are set in Phase 1 Question 1. Strand builds from there.

Both use the same `TripDNAStrand` component. No mode-specific variants needed.

---

## Open Questions for Kitchen

1. Does `TripDNAStrand` live in `src/components/UI/` (generic primitive) or `src/components/Landing/` (landing-specific)? Leaning toward `Landing/` since it only appears during the icebreaker flow.
2. Line draw animation — CSS `width` transition or SVG `stroke-dashoffset`? SVG gives more control over the gradient and node positioning. Worth the slightly higher complexity.
3. Should fuel stop nodes show a count label on mobile where individual dots might be too small? e.g. "~4 stops" as text instead of 4 dots.
4. Does the strand persist into Phase 2 (workshop) or fade out when the icebreaker completes and only return at the map reveal?

---

## Design Principles to Hold

**Shape, not truth.** The strand is an estimate. It will be wrong about exactly where fuel stops land. That's fine — precision is the map's job.

**Instant feedback.** Every answer produces immediate visual change. No loading. No API wait. The node appears the moment the answer is confirmed.

**The line animates in before any answer.** That first empty line is load-bearing — it signals that something is about to be built. Don't skip it.

**Mobile vertical is not a compromise.** Top-to-bottom is the natural reading direction on a phone. The vertical strand might actually be the better experience.

**Disappears cleanly.** The strand's job ends when the map appears. The transition should feel like a handoff, not a replacement.

---

💚 My Experience Engine — Built by Aaron "Chicharon" with the UV7 crew

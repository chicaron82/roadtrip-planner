# Tech Debt Tracker — Roadtrip Planner (MEE)

## Weekend Refactor Sprint (completed 2026-02-27)

### App.tsx — Push toward 300-line target ✅ DONE
**384 → 298 lines. ESLint guard 460 → 320.**
- ✅ Extracted `resetTrip` + `handleSelectMode` → `useAppReset`
- ✅ Extracted 30-prop `<PlanningStepContent>` assembly → `usePlanningStepProps` (+ internalized `handleAddPOI`)
- ✅ Extracted `calculateAndDiscover` → `useCalculateAndDiscover` (owns settingsRef)
- ✅ Extracted `mapProps` assembly → `useMapProps`

### useTripCalculation.ts — Break up the calculateTrip megacallback ✅ DONE
**644 → 476 lines. New file: `src/lib/trip-calculation-helpers.ts` (201 lines).**
- ✅ Extracted `buildRoundTripSegments` → `trip-calculation-helpers.ts`
- ✅ Extracted `checkAndSetOvernightPrompt` → `trip-calculation-helpers.ts`
- ✅ Extracted `fireAndForgetOvernightSnap` → `trip-calculation-helpers.ts`
- NOTE: `buildDayItinerary` extraction deferred — the splitTripByDays call + cost breakdown is simple enough inline

### split-by-days.ts — Extract midpoint insertion block
**Priority: LOW** — 503 lines, still over 300. Deferred (risk: complex mutable state threading).
- `insertFreeDaysAtMidpoint(days, processedSegments, settings, ...)` → dedicated function (~100 lines)
- Requires state object pattern for 8+ mutated vars — do when tackling file properly

---

## Transit Sub-Segment Boss Fight (in progress — 2026-03-01)

### ✅ Dual-path iteration (6b92fc5)
- trip-timeline.ts: iterates sub-segments via `drivingDays.flatMap(d => d.segments)`
- generate.ts: flat-index dayStartMap, segOrigIdx remapping, timezone guard
- day-builder.ts: midnight placeholder detection

### ✅ Bug A: Transit timezone progression (fixed)
- Was: `_transitPart` guard blocked ALL timezone updates for sub-segments
- Fix: derive timezone from sub-segment's FROM longitude via `lngToIANA` + `ianaToAbbr`
- generate.ts: updates `state.currentTzAbbr` per-sub-segment from coordinates
- trip-timeline.ts: updates `activeTimezone` per-sub-segment from coordinates

### ✅ Bug B: Missing Depart on transit days (fixed)
- Emits a departure event when `dayStartMap.has(i)` fires at day boundaries

### ✅ Bug C: Post-arrival fuel stop (fixed)
- `boundaryAfter` now suppresses non-overnight stops on `isLastSegment`

### ✅ Bug D: Unnamed comfort stops (fixed)
- Return-leg km positions are now mirrored onto the outbound geometry via `toGeometryKm`
- Both per-segment hub lookup and en-route hub resolver use the mirror

### ✅ Free day off-by-one (eaff613)
- `slice(i+1)` → `slice(i)` to include first return sub-segment in the estimate
- Denominator changed from `maxDriveMinutes` → `effectiveMaxDriveMinutes`

### ✅ Dual fuel model disconnect (resolved — 763fa58)

- day-builder.ts now uses strategic fuel stops as primary model (at-the-pump cost per stop)
- segment.fuelCost math used only for the home stretch after the last stop
- totalFuelCost in summary sourced from calculateCostBreakdown (sum of reconciled daily costs)
- ~$57 Winnipeg→Vancouver discrepancy eliminated

### ✅ Day-trip override bug (21af77a)
- Multi-day trips with high maxDriveHours (e.g. 16h) were treated as "day trips"
- isRoundTripDayTrip now also requires calendarDays <= 1
- Repro: Winnipeg→Thunder Bay 3d/2n, maxDriveHours=16h → car drove to T-Bay and back, overnighted in Winnipeg

---

## Feature: Unified Journey Car 🚗 (planned — 2026-03-02)

**One car component, two modes, zero new layout real estate.**

The `<CarTrack>` replaces the pill-dot step indicators in `StepsBanner` during planning,
then seamlessly becomes the live trip progress bar once the trip is confirmed.

### Overview

```
Planning mode:   [Route] ——🚗—— [Vehicle] ———— [Results]
Trip mode:       [Winnipeg] ——🚗—— [Portage] ———— [Brandon]
                                      ↓ car passes Portage
                 [Portage] ——🚗—— [Brandon] ———— [Regina]
```

Window paginates (3 stops visible) as car crosses stop 1. World slides left,
new stop fades in from right. Car stays visually in the middle third.

---

### Phase 1 — CarTrack (wizard mode)

**New file: `src/components/UI/CarTrack.tsx`** (~150 lines)

Props:
```ts
interface CarTrackProps {
  mode: 'wizard' | 'trip';
  // wizard mode
  currentStep?: 1 | 2 | 3;
  isCalculating?: boolean;
  onStepClick?: (step: 1 | 2 | 3) => void;
  completedSteps?: number[];
  // trip mode
  stops?: string[];           // all waypoint names, origin→destination
  progressPct?: number;       // 0–100, from useGhostCar
  windowIndex?: number;       // which 3-stop page we're on
  onArrived?: (idx: number) => void;
}
```

Animations:
- Car slides with `transition: left 0.8s ease`
- `isCalculating` → idle wiggle keyframe (car bouncing in place)
- Arrival at last visible stop → `translateX` slide left, new stop fades in from right
- Final destination: arrival bounce + 🎉 flash

**Modify: `src/components/StepsBanner.tsx`**
- Replace Row 2 pill dots with `<CarTrack mode="wizard" ...>`
- Net line change: ~0 (swap, not add)

---

### Phase 2 — Ghost Car simulation

**New file: `src/hooks/useGhostCar.ts`** (~120 lines)

```ts
interface GhostCarState {
  progressPct: number;        // 0–100, position along full route
  kmDriven: number;
  kmRemaining: number;
  eta: string;                // "~9:45 PM" or "Arrived"
  windowIndex: number;        // current 3-stop page
  windowStops: string[];      // the 3 currently visible stop names
  tripStarted: boolean;       // false before departure time
  tripComplete: boolean;
  startsIn: string | null;    // "Departs in 2h 15m" pre-trip
}

function useGhostCar(
  timeline: TimedEvent[],
  waypoints: string[],        // origin + stops + destination
  departureTime: string,      // ISO
): GhostCarState & { anchorAt: (waypointIndex: number) => void }
```

Logic:
- Ticks every 30s via `setInterval`
- Binary search `TimedEvent[]` by `Date.now()`, lerp km between bracketing events
- `anchorAt(idx)` — called by journal tap-to-arrive — resets simulation origin
  to waypoint[idx] at current time, re-lerps forward from there
- Before departure: shows `startsIn` countdown, `progressPct = 0`
- After final arrive: `tripComplete = true`, car parked at destination

Window pagination:
- `windowIndex` advances when `progressPct` crosses the threshold for visible stop 1
- Slide animation triggered by `windowIndex` change in `CarTrack`

---

### Phase 3 — Journal integration

**Modify: `src/hooks/useJournal.ts`**
- `tapToArrive(waypointIndex)` — existing concept, now calls `ghostCar.anchorAt(idx)`
- On tap: fire single `navigator.geolocation.getCurrentPosition()` (one-shot, not watched)
  - If within 50km of waypoint → snap silently
  - If >50km away → confirm dialog: "You're ~120km from Thunder Bay — mark arrived anyway?"
- After confirm: `anchorAt` → car snaps to stop → window paginates → journal entry form opens

**Journal entry form trigger (arrival cinematic):**
1. Car inches toward waypoint
2. User taps "Arrived at [Stop]"
3. GPS one-shot check (silent if near, confirm if far)
4. Car slides to stop with arrival bounce 🎉
5. CarTrack window paginates — old stop exits left, new stop enters right
6. Journal prompt opens: *"You made it. What happened here?"* → photo + caption + rating

---

### Phase 4 — End-of-trip recap card

Triggered when final destination is tapped as arrived.

**New file: `src/components/Trip/TripRecapCard.tsx`** (~100 lines)

```
🏁  Winnipeg → Vancouver
📅  Mar 2 – Mar 8  ·  6 days
📍  5 stops  ·  3 journal entries
📷  12 photos
🛣  2,883 km driven
```

- Auto-generated from trip result + journal state
- Share as image (html-to-canvas) or copy a summary link
- Car shown parked at destination with a small "THE END" or arrival timestamp
- Closes the narrative arc: the car that started at Route now parks at home

---

### File summary

| File | Action | Est. lines |
|------|--------|-----------|
| `src/components/UI/CarTrack.tsx` | **Create** | ~150 |
| `src/hooks/useGhostCar.ts` | **Create** | ~120 |
| `src/components/Trip/TripRecapCard.tsx` | **Create** | ~100 |
| `src/components/StepsBanner.tsx` | **Modify** | swap Row 2 |
| `src/hooks/useJournal.ts` | **Modify** | +tapToArrive anchor |
| `src/App.tsx` | **Modify** | pass ghostCar props |

### Cook order
1. `CarTrack.tsx` — wizard mode only, visible immediately (no data deps)
2. `useGhostCar.ts` — simulation engine + anchor API
3. Wire `StepsBanner` → trip mode + ghost car data
4. Journal `tapToArrive` + GPS one-shot
5. `TripRecapCard.tsx` — final destination arrival


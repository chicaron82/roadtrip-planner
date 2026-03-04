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

## Feature: Unified Journey Car 🚗 ✅ COMPLETE (2026-03-02/03)

**One car component, two modes, zero new layout real estate.**

### ✅ Phase 1 — CarTrack wizard mode (dabeaf3)
- `CarTrack.tsx` (206 lines) — discriminated union props, wizard + trip modes
- Replaces pill-dot step indicators in `StepsBanner`
- CSS keyframes in `sidebar.css`: car-arrive, car-calculating, car-pending, track-slide-in
- `stopPct()` math: equal-flex 3-stop track, centers at 16.67/50/83.33%

### ✅ Phase 2 — Ghost Car simulation (4d68b9f + f24d9fd + a440035 + 9a73361)
- `useGhostCar.ts` (251 lines) — time-based simulation, 30s tick
- Binary search + lerp on `TimedEvent[]` for real-time position
- `timeShiftMs` anchor approach: shifts reference frame on tap-to-arrive
- `anchorAt(idx)` — snaps car to waypoint, re-lerps forward from there
- 20 unit tests covering `binarySearchLast` + `interpolateKm` pure fns
- Uses suggested stops for waypoint km resolution

### ✅ Phase 3 — Journal tap-to-arrive (a8e13c9)
- `useArrivalSnap.ts` (96 lines) — listens for `mee-stop-arrived` custom events
- One-shot GPS check (no continuous tracking); arrival always recorded
- Within 80km → silent anchor; outside → anchor anyway + toast hint

### ✅ Phase 4 — End-of-trip recap card (8f2272f)
- `TripRecapCard.tsx` (250 lines) — replaces plain `JournalCompletionCard`
- Parked 🚗 at end of mini track closes narrative arc
- Stats: stops visited, km driven, photos, journal entries, date span
- Share (Web Share API → clipboard), Export HTML, Share as Template

### Also shipped alongside (6798fd3)
- `weather-ui-utils.ts` — weather code → CSS gradient + hex color
- SmartTimeline drive line now weather-reactive (sky blue = clear, indigo = thunderstorm)
- `data-ambient` hooks on departure/overnight nodes for future cinematic pass

---

## Architectural Watchlist (identified 2026-03-03)

Items that are not broken today but are known future drift vectors.
Address when a related feature is next touched — not as standalone refactors.

### TODO: Split trip-print-builders.ts by responsibility
**Priority: LOW — address when next major print feature lands**
`src/lib/trip-print-builders.ts` is ~400 lines and growing.
Currently owns: time/number formatting, event bucketing, day HTML assembly,
budget string building, hotel card, segment HTML, and the top-level envelope.
This breadth makes it a natural place for one-off fixes that breed print-only bugs.
- Suggested split: `trip-print-formatters.ts` (time, distance, currency) / `trip-print-sections.ts` (HTML builders)
- Trigger: next time the file exceeds 450 lines or a print-only bug is traced here

### TODO: Day arrival time derived independently from the event chain
**Priority: LOW — watch when combo-stop optimization or stop insertion evolves**
`src/lib/budget/day-builder.ts` computes `totals.arrivalTime` as:
  `departure + driveTimeMinutes + stopTimeMinutes`
The timeline event chain (`buildTimedTimeline`) computes arrival independently
from the actual sequence of timed events including combo savings, inserted breaks, etc.
If either path evolves without updating the other, day-header arrival times will drift
from the last timed event in that day's timeline.
- Long-term ideal: `totals.arrivalTime` sourced from final timed event in the day
- Trigger: next time combo-stop optimization changes stop durations meaningfully


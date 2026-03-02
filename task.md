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

---

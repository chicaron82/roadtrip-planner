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

### 🐛 Bug A: Stop times before departure on transit return legs
**Priority: HIGH** — En-route fuel stops on return transit days show times before the day's departure hour (e.g., fuel at 6:45 AM on a 10:00 AM departure).
- Root cause: under investigation. Likely interaction between `_transitPart` timezone guard (which skips ALL transit sub-segments) and `handleDayBoundaryReset` clock.
- The guard prevents PDT from applying on Day 1 (correct), but also prevents timezone progression across multi-day transit (incorrect for days 2+).

### 🐛 Bug B: Missing Depart node on transit days
- Days 2+ of a transit leg have no "🚗 Depart" event — just a drive connector.
- Trip-timeline needs to emit a depart event when `dayStartMap.has(i)`.

### 🐛 Bug C: Post-arrival fuel stop
- Day 8 (final day): a full-fill fires AFTER the 🏁 Arrive event.
- `inDestinationGraceZone` or `isFinalSegment` check may not be handling the last sub-segment correctly.

### 🐛 Bug D: Unnamed comfort stops
- Comfort en-route stops show "~290 km from Winnipeg" instead of hub names.
- Hub resolver may not be interpolating position correctly for sub-segments (segmentStartKm offset).

### 💳 Dual fuel model disconnect
**Priority: MEDIUM** — day-builder.ts sums raw `segment.fuelCost` (L/km × price) for daily gas budget, but stop suggestions show human fill amounts ($74 full, $41 top-up). Both numbers appear in the same itinerary. ~$57 discrepancy on 8-day Winnipeg→Vancouver trip. Needs reconciliation to one model.

---

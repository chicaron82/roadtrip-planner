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

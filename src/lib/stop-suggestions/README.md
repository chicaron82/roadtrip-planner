# `stop-suggestions/` — Stop Simulation Engine

Simulates the full drive in real-time to place stops where they actually make sense, not at arbitrary km-marks.

---

## Pipeline

```
generate.ts
  │  Drives the route km-by-km using elapsed minutes and distance.
  │  At each tick, calls stop-checks.ts modules in priority order:
  │
  ├─ stop-checks.ts          ← entry point; imports and re-exports all check modules
  │
  ├─ stop-checks-fuel.ts     ← Strategic fill-ups based on tank math + safety buffer.
  │                             En-route fuel stops for very long legs.
  │
  ├─ stop-checks-rest.ts     ← Rest breaks based on continuous hours on road.
  │                             Respects stop frequency preference (Minimal/Balanced/Frequent).
  │
  ├─ stop-checks-overnight.ts← Overnight split suggestions when a leg exceeds max daily hours.
  │                             Meal stop detection (breakfast/lunch/dinner windows by time of day).
  │
  ├─ timezone.ts             ← Timezone transition detection along the route.
  │                             Uses longitude → IANA → abbreviation resolution.
  │
  └─ consolidate.ts          ← Post-simulation deduplication and combo-stop merger.
                                "⛽ filling up while we eat" transparency logic.
```

---

## Key Files

### `generate.ts`
The main simulation loop. Imports `flattenDrivingSegments` to expand sub-segments, iterates the full route geometry, and dispatches to stop-check modules at each position. Handles:
- Day boundary resets (max drive hours exceeded → new day)
- Hub cache lookup for human-readable city names at each stop position
- Timezone progression per sub-segment
- Passes state through a `SimState` object (see `types.ts`)

### `stop-checks.ts`
Barrel export and shared entry point. Exports all individual check functions so `generate.ts` has one clean import.

### `stop-checks-fuel.ts`
Owns all fuel logic:
- `checkFuelStop()` — evaluates whether current km position triggers a fill-up based on remaining range
- `getEnRouteFuelStops()` — for very long segments, calculates fractional fuel stop positions
- Uses `fuel-stop-snapper.ts` (from parent `lib/`) to resolve km-position → hub city name

### `stop-checks-rest.ts`
Owns rest break scheduling:
- `checkRestBreak()` — fires when continuous driving minutes exceeds threshold
- Configurable via `stopFrequency` setting (Minimal = longer gaps, Frequent = shorter)

### `stop-checks-overnight.ts`
Owns meal + overnight logic:
- `checkMealStop()` — detects breakfast/lunch/dinner windows from current wall-clock time; suppresses end-of-trip meals on round trips arriving home
- `checkOvernightStop()` — proposes a split point when remaining drive time would exceed `maxDriveHours`

### `consolidate.ts`
Post-processing after the full simulation:
- Deduplicates nearby stops (stops within 15 min of each other)
- Merges fuel stops absorbed by a meal stop into a combo card
- Sets `_comboNote: '⛽ filling up while we eat'` on merged stops for UI transparency

### `timezone.ts`
Stateless helpers for timezone handling within the simulation:
- `applyTimezoneShift()` — detects longitude crossing a timezone boundary, updates `SimState.currentTzAbbr`

### `types.ts`
Internal `SimState` interface — the mutable simulation state object threaded through all check functions. Includes current km, elapsed minutes, time-of-day clock, current timezone, fuel remaining, driver fatigue, etc.

### `index.ts`
Public re-export barrel. Consumers (e.g. `useTripCalculation`) import from the index, not from individual files.

---

## Design constraints

- **No direct API calls.** The simulation is offline — it consumes pre-fetched route geometry and calls `hub-cache.ts` for name resolution (which may trigger async POI analysis, but that's non-blocking).
- **Pure simulation inputs.** `generate.ts` takes `RouteSegment[]` + `StopSuggestionConfig` and returns `SuggestedStop[]`. No side effects except hub cache writes.
- **Hub cache is the only external dependency.** And even that degrades gracefully — if the cache misses, the stop still appears with a km-mark description.

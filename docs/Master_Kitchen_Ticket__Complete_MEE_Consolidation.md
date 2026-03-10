# Master Kitchen Ticket - Validated MEE Consolidation Backlog

**Validated on:** March 10, 2026  
**Workspace:** roadtrip-planner  
**Status:** Complete; backlog resolved and recast as a closure record

## Executive Summary

The original consolidation ticket was directionally correct, but parts of it were already stale by the time of validation. That backlog is now closed.

Already landed:

- Context memoization and split contexts.
- Async generation-token protection in trip calculation.
- Debounced settings persistence.
- Most of the listed dead-file cleanup.
- `TripViewer` and `useStep3Controller`.
- Summary drift removal by deriving `summary` from canonical timeline state.
- Reset / restore / URL boot semantic extraction.
- Canonical print payload flow and print-builder narrowing.
- Accepted-itinerary and viewer contract narrowing.
- Health / budget slice narrowing where the UI did not need full trip objects.
- Final decomposition of the remaining oversized UI files.

Closed in this pass:

- Dual truth-model drift risk.
- Reset / restore semantic ambiguity.
- Viewer / itinerary broad contract sprawl.
- Step 3 downstream contract sprawl.
- Remaining large-file decomposition targets.

Residual non-blocking watch items:

- Some owner surfaces still legitimately use full `TripSummary` because they create, persist, or present the full trip object.
- A fresh dead-code/import audit can happen later as normal maintenance, not as part of this ticket.

This file now replaces the original 13-course snapshot with a validated closure record.

## Validation Matrix

### Closed

- Truth model consolidation: Closed. `summary` is now derived from canonical timeline state, removing drift risk.
- Reset and restore semantics: Closed. Reset, restore, and boot flows are named and separated.
- Finish viewer boundary: Closed enough for this pass. Viewer-facing surfaces now consume prepared/narrow contracts rather than broad trip objects where they do not own trip truth.
- Reduce Step 3 props surface: Closed enough for this pass. Remaining broad uses are owner surfaces, not prop-sprawl leaks.
- Large-file decomposition: Closed. `FlexibleDay.tsx` and `TimelineNode.tsx` were split under the line target.

### Residual Maintenance

- Architecture contract drift: Closed for this ticket. `App.tsx` is back under the long-term target trajectory.
- Graveyard cleanup: Deferred. The old dead-file list was stale; any further cleanup should start from a fresh import audit.

### Drop From Active Backlog

- Async race protection: Closed enough for now. `calcRunIdRef` and abort handling already guard the known async paths in `useTripCalculation`.
- Context memoization: Closed. Split contexts plus memoized provider values are already landed.
- Settings persistence write amplification: Closed. Settings persistence is already debounced.

## Closure Notes

### Truth Model Consolidation

Final state:

- `summary` is derived from canonical timeline state, and write paths patch canonical state rather than drifting in parallel.

Files in play:

- `src/contexts/TripContext.tsx`
- `src/hooks/useTripCalculation.ts`
- `src/lib/canonical-trip.ts`
- Downstream consumers that still conceptually treat `summary` as source of truth.

Success condition: Met.

### Reset / Restore Semantics

Final state:

- Reset, restore, and boot flows were separated into named semantic layers and rewired through dedicated helpers.

Files in play:

- `src/hooks/useAppReset.ts`
- `src/hooks/useTripRestore.ts`
- `src/hooks/useURLHydration.ts`
- An optional helper module for reset semantics.

Success condition: Met.

### Finish Viewer Boundary

March 10 additional progress landed:

- Print builders now consume canonical `PrintInput` directly instead of parallel summary/settings/day arguments.
- Accepted-itinerary projection, accepted-itinerary timeline, and timeline simulation now advertise narrower route contracts instead of full `TripSummary`.
- Journal export and journal-storage helper signatures were narrowed to route/export slices where they only read endpoints or segment lookup.

What is already done:

- `TripViewer` exists.
- `useStep3Controller` exists.

Final state:

- Viewer-facing surfaces now consume narrower accepted-itinerary / route / export slices.
- Smart timeline, itinerary, journal timeline, and discovery surfaces no longer advertise full-trip contracts where they do not need them.
- Remaining reconstruction lives in explicit owner helpers rather than leaking through broad presentation props.

Files in play:

- `src/components/Trip/TripTimelineView.tsx`
- `src/components/Trip/Itinerary/useTimelineData.ts`
- `src/components/Trip/Itinerary/useTimelineDerivedMaps.ts`
- `src/components/Trip/Itinerary/ItineraryTimeline.tsx`
- `src/components/Trip/Itinerary/ItineraryTimelineBody.tsx`
- `src/components/Trip/Timeline/SmartTimeline.tsx`
- `src/lib/accepted-itinerary-projection.ts`

Success condition: Met for this consolidation pass.

## Strengthening Work Closed

### Reduce Step 3 Props Surface

Final state:

- Step 3 controller/model work stayed centralized, while downstream viewer and print surfaces were narrowed to recap, health, and print-specific contracts.

Files in play:

- `src/hooks/useStep3Controller.ts`
- `src/components/Steps/Step3Content.tsx`
- `src/App.tsx`

### Restore the 300-Line Trajectory

Final state:

- `App.tsx` is under the long-term target and no longer the blocking concern from the original ticket.

Files in play:

- `src/App.tsx`
- `eslint.config.js` only after App is actually below 300.

## Polish Work Closed

### Narrow Remaining Viewer / Health Contracts

Final state:

- Viewer, itinerary, journal, discovery, smart timeline, health, and budget surfaces were narrowed to dedicated slices.
- Hook helpers like `useAddedStops`, `useMapInteractions`, and the overnight-prompt path were also narrowed where they did not need full trip ownership.

### Decompose Remaining Large Files

Primary targets resolved:

- `src/components/Trip/Itinerary/FlexibleDay.tsx`
- `src/components/Trip/Timeline/TimelineNode.tsx`

## Validation Result

Validated at closure with:

1. Targeted ESLint across all touched surfaces.
2. `npx tsc --noEmit`.
3. Focused regressions for trip analyzer, feasibility, journal timeline, print, accepted itinerary, timeline simulation, and journal storage.

## Notes From Validation

- `TripViewer` is already landed; do not open a ticket to create it again.
- `useStep3Controller` is already landed; future work should expand it, not duplicate it.
- The dead-code list from the original ticket is stale.
- The original async-race and context-memoization courses should not be reopened unless new evidence appears.

This is now the canonical closure record for the consolidation pass.

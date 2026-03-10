# Master Kitchen Ticket - Validated MEE Consolidation Backlog

**Validated on:** March 10, 2026  
**Workspace:** roadtrip-planner  
**Status:** Recut after code review; stale items removed, active risks reprioritized

## Executive Summary

The original consolidation ticket was directionally correct, but parts of it were already stale by the time of validation.

Already landed:

- Context memoization and split contexts.
- Async generation-token protection in trip calculation.
- Debounced settings persistence.
- Most of the listed dead-file cleanup.
- `TripViewer` and `useStep3Controller`.

Still materially open:

- Dual truth model: `summary` and `canonicalTimeline.summary` can still drift if not explicitly synchronized.
- Reset and restore semantics are still overloaded across app reset, history restore, and URL boot.
- Viewer boundary is only partially complete; accepted-itinerary projection still rebuilds locally in the itinerary layer.
- Step 3 still has a large prop surface.
- A few oversized files still deserve decomposition.

This file replaces the original 13-course snapshot with a validated backlog.

## Validation Matrix

### Keep High Priority

- Truth model consolidation: Active. `summary` and `canonicalTimeline.summary` are still parallel state.
- Reset and restore semantics: Active. `useAppReset`, `useTripRestore`, and `useURLHydration` still represent different lifecycle semantics.
- Finish viewer boundary: Active, but rewrite the scope. `TripViewer` exists, but accepted-stop projection still lives in the itinerary layer.
- Reduce Step 3 props surface: Active. `Step3Content` is thinner, but its API is still wider than it should be.
- Large-file decomposition: Active, narrowed. `FlexibleDay.tsx` and `TimelineNode.tsx` remain the main offenders.

### Rewrite Or Downgrade

- Architecture contract drift: Rewrite. Docs and lint now agree on a temporary 320-line cap; the real issue is returning `App.tsx` to the long-term 300-line target.
- Graveyard cleanup: Rewrite. The old dead-file list is stale; future cleanup should start from a fresh import audit.

### Drop From Active Backlog

- Async race protection: Closed enough for now. `calcRunIdRef` and abort handling already guard the known async paths in `useTripCalculation`.
- Context memoization: Closed. Split contexts plus memoized provider values are already landed.
- Settings persistence write amplification: Closed. Settings persistence is already debounced.

## Priority 1 - Fire First

### Truth Model Consolidation

Current risk:

- Day edits and partial writes can desync `summary` from `canonicalTimeline.summary`.

March 10 progress landed:

- Context setters now bridge `summary` and `canonicalTimeline.summary` so they stay synchronized during the migration.

Next phase:

- Remove write sites that conceptually mutate only `summary`.
- Move callers toward `canonicalTimeline` as the primary mutable surface.
- Collapse read sites toward canonical-first access where practical.

Files in play:

- `src/contexts/TripContext.tsx`
- `src/hooks/useTripCalculation.ts`
- `src/lib/canonical-trip.ts`
- Downstream consumers that still conceptually treat `summary` as source of truth.

Success condition:

- No code path can update `summary` without keeping canonical state aligned.
- New mutations prefer canonical writes.

### Reset / Restore Semantics

Current risk:

- Reset means different things in different places.

What exists today:

- `useAppReset.resetTrip()` is a broad session reset.
- `useTripRestore.restoreTripSession()` restores history by recalculating from locations.
- `useURLHydration()` boots from URL, persisted origin, and adaptive defaults.

Plan:

- Name the semantic levels explicitly: inputs, results, session, app.
- Keep history restore on the honest recalc path.
- Make boot and restore flows explicit about which layers they rebuild.

Files in play:

- `src/hooks/useAppReset.ts`
- `src/hooks/useTripRestore.ts`
- `src/hooks/useURLHydration.ts`
- An optional helper module for reset semantics.

Success condition:

- Reset names describe exactly what they clear.
- Restore paths are explicit about whether they hydrate or recalculate.

### Finish Viewer Boundary

Current risk:

- The shell is thinner, but accepted-stop projection still lives inside itinerary and view helpers.

What is already done:

- `TripViewer` exists.
- `useStep3Controller` exists.

What still needs work:

- Reduce local itinerary reconstruction in `useTimelineData` and accepted-itinerary projection helpers.
- Push accepted-stop truth further upstream instead of rebuilding it only in the display layer.
- Re-evaluate whether `TripTimelineView` still earns its existence as a separate routing layer.

Files in play:

- `src/components/Trip/TripTimelineView.tsx`
- `src/components/Trip/Itinerary/useTimelineData.ts`
- `src/components/Trip/Itinerary/useTimelineDerivedMaps.ts`
- `src/lib/accepted-itinerary-projection.ts`

Success condition:

- Viewer reads a prepared itinerary contract instead of rebuilding core truth locally.

## Priority 2 - Strengthen

### Reduce Step 3 Props Surface

Current risk:

- `Step3Content` is render-thinner but still receives too many unrelated concerns directly.

Plan:

- Expand controller bundling so Step 3 consumes grouped feature slices instead of raw prop sprawl.
- Keep App wiring thin.

Files in play:

- `src/hooks/useStep3Controller.ts`
- `src/components/Steps/Step3Content.tsx`
- `src/App.tsx`

### Restore the 300-Line Trajectory

Current risk:

- The temporary 320-line cap is real, but `App.tsx` is still above the long-term target.

Plan:

- Extract enough remaining coordination to get back under 300.
- Only tighten ESLint after the file is genuinely back under the target.

Files in play:

- `src/App.tsx`
- `eslint.config.js` only after App is actually below 300.

## Priority 3 - Polish

### Decompose Remaining Large Files

Primary targets:

- `src/components/Trip/Itinerary/FlexibleDay.tsx`
- `src/components/Trip/Timeline/TimelineNode.tsx`

Optional follow-up:

- Fresh dead-code audit after the architectural work settles.

## Immediate Cook Order

1. Keep the new summary and canonical bridge in place and remove the highest-risk drift paths.
2. Name reset semantics and align the restore and boot flows.
3. Finish the viewer boundary by moving accepted-itinerary truth upstream.
4. Bundle Step 3 feature state to shrink the props surface.
5. Only then tighten App and polish the remaining large files.

## Notes From Validation

- `TripViewer` is already landed; do not open a ticket to create it again.
- `useStep3Controller` is already landed; future work should expand it, not duplicate it.
- The dead-code list from the original ticket is stale.
- The original async-race and context-memoization courses should not be reopened unless new evidence appears.

This is now the canonical backlog for the consolidation pass.

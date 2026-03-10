Spec: Step 3 as Results Gate \+ Single Canonical Viewer Pipeline

Goal

Refactor the current Step 3 flow so that:

Step 3 becomes the calculated-results checkpoint

There is exactly one canonical timeline

All accepted changes are applied upstream at the source of truth

Viewer surfaces render the canonical timeline and emit intents only

Print/export always derives from the same canonical truth

This preserves the rule you called out:

\> One timeline exists and remains. Changes must be applied upstream at the source, not at the end where things can vary.

\---

Product intent

Current problem

Step 3 is carrying too much mixed responsibility:

result presentation

canonical timeline display

journal display/editing

suggestion interaction

itinerary editing

POI discovery acceptance/dismissal

overnight prompts

commit/history behaviors

Even though some of that is split into subcomponents, the product boundary is still overloaded.

Target shape

Step 3 \= Results Gate

Step 3 should answer:

Did calculation succeed?

What is the trip summary?

What does the canonical timeline look like right now?

Is the trip feasible / healthy / confirmed?

Does the user want to open the viewer/workspace?

Viewer \= Dumb Renderer \+ Intent Emitter

Viewer should:

render what it is given

render canonical timeline

render journal state

render smart suggestions

let the user accept / dismiss / edit

emit actions upward

Viewer should not:

own itinerary truth

rebuild timeline truth locally

patch a shadow copy

create print-specific variants

make domain decisions about merge/canonical rules

\---

Core architecture law

Single source of truth

There is exactly one itinerary truth:

canonicalTimeline

Every surface must derive from it:

Step 3

viewer/workspace

journal views

print/export

saved-trip restore displays

All accepted user changes must be applied upstream to canonical source state.

No local “viewer timeline.” No print-prep timeline. No alternate end-of-pipeline patch layer.

\---

Proposed flow

Calculation flow

1\. User calculates trip

2\. Calculation pipeline produces:

summary

canonicalTimeline

supporting derived metadata

3\. Step 3 displays those results

Viewer flow

1\. User opens viewer

2\. Viewer receives:

canonicalTimeline

summary

journal

poiSuggestions

packingSuggestions

any other viewer-ready props

3\. Viewer renders the trip and exposes actions

4\. User accepts/dismisses/edits something

5\. Viewer emits intent upward

6\. Upstream controller/domain layer mutates canonical truth

7\. Viewer re-renders from updated canonical truth

Print flow

1\. User prints/exports

2\. Print view reads canonical source state

3\. Printed itinerary reflects the real current plan

\---

Responsibilities by layer

Step 3 responsibilities

Step 3 should keep:

calculation success/failure display

trip summary snapshot

feasibility / health / overview

canonical timeline preview or full canonical timeline display

trip confirmation state

share/open actions

history/recent trip access if still desired

CTA to viewer/workspace

Step 3 should stop owning:

deep itinerary editing behavior

journal-specific interaction flows

POI suggestion workflow UI

packing workflow UI

local mutation logic for viewer features

Repo note

Current src/components/Steps/Step3Content.tsx still reaches into context and coordinates too much. That should shrink substantially.

\---

Viewer responsibilities

Viewer should receive data and callbacks only.

It may render:

canonical timeline

day sections

journal mode

smart packing suggestions

POI discovery suggestions

overnight details

edit affordances

It may emit intents like:

onAddPoi

onDismissPoi

onAcceptPackingSuggestion

onDismissPackingSuggestion

onUpdateDayTitle

onUpdateDayNotes

onUpdateDayType

onUpdateOvernight

onAddDayActivity

onUpdateDayActivity

onRemoveDayActivity

Viewer should not:

compute canonical updates internally

hold a local authoritative itinerary

create a forked timeline model

own merge logic

\---

Upstream canonical controller responsibilities

Need a controller/service layer that owns mutation rules for canonical timeline.

This layer should:

accept viewer intents

transform canonical truth

keep summary/timeline consistency

centralize POI insertion rules

centralize dismissal rules

centralize packing acceptance rules if they affect canonical data

centralize day/activity mutations

This is where “smart” behavior lives.

\---

Recommended state model

Canonical state upstream

Keep authoritative state upstream for:

summary

canonicalTimeline

accepted POIs

dismissed POIs

accepted/dismissed packing suggestions if persisted

journal data, if journal is part of real trip state

trip confirmation state

Viewer state local

Viewer may keep lightweight UI-only state such as:

expanded section

selected tab

open dialog

hovered card

fullscreen journal toggle

selected day in UI

Viewer local state must never become itinerary truth.

\---

Suggested file direction

This is not a literal final structure, but it’s the shape I’d hand the kitchen.

Existing files likely to change

Step layer

src/components/Steps/Step3Content.tsx

src/components/Steps/Step3TimelineSection.tsx

src/components/Steps/step3-types.ts

Context/state layer

src/contexts/TripContext.tsx

Hooks/controllers

src/hooks/usePlanningStepProps.ts

possibly new controller hook(s)

Viewer-capable existing surfaces

src/components/Trip/Itinerary/\*

src/components/Trip/Journal/\*

src/components/Trip/Discovery/\*

src/components/Trip/StepHelpers/TripPrintView.tsx

New files I’d likely introduce

Controller layer

src/hooks/useCanonicalTripController.ts or

src/hooks/useTripViewerController.ts

Purpose:

expose canonical state

expose viewer action callbacks

centralize canonical mutations

Viewer surface

src/components/Trip/Viewer/TripViewer.tsx

src/components/Trip/Viewer/TripViewerTimeline.tsx

src/components/Trip/Viewer/TripViewerSidebar.tsx or equivalent

src/components/Trip/Viewer/viewer-types.ts

Could be fewer files at first, but this is the seam.

Canonical mutation helpers

Potential lib helpers:

src/lib/canonical-updates/add-poi-to-canonical.ts

src/lib/canonical-updates/dismiss-poi.ts

src/lib/canonical-updates/update-day-metadata.ts

src/lib/canonical-updates/update-day-activity.ts

You do not need that exact folder, but the important thing is: mutation rules should stop living ad hoc across UI surfaces.

\---

Suggested prop contract

Step 3 should become much smaller

Instead of Step 3 owning a huge mixed prop surface, it should receive something closer to:

interface Step3ResultsGateProps {  
  summary: TripSummary | null;  
  canonicalTimeline: CanonicalTripTimeline | null;  
  tripMode: TripMode;  
  tripConfirmed: boolean;  
  isCalculating?: boolean;  
  health: Step3HealthModel | null;  
  history: TripSummary\[\];  
  shareUrl: string | null;

  onConfirmTrip: () \=\> void;  
  onUnconfirmTrip: () \=\> void;  
  onOpenViewer: () \=\> void;  
  onOpenGoogleMaps: () \=\> void;  
  onCopyShareLink: () \=\> void;  
  onGoToStep: (step: PlanningStep) \=\> void;  
  onLoadHistoryTrip?: (trip: TripSummary) \=\> void;  
}

That’s way cleaner than Step 3 directly juggling journal edits, POI interactions, activity edits, and so on.

Viewer prop shape

interface TripViewerProps {  
  summary: TripSummary;  
  canonicalTimeline: CanonicalTripTimeline;  
  journal: TripJournal | null;  
  tripMode: TripMode;  
  activeChallenge?: TripChallenge | null;

  poiSuggestions: POISuggestion\[\];  
  packingSuggestions: PackingSuggestion\[\];  
  isLoadingPOIs: boolean;  
  poiPartialResults?: boolean;  
  poiFetchFailed?: boolean;

  onAddPOI: (poiId: string, segmentIndex?: number) \=\> void;  
  onDismissPOI: (poiId: string) \=\> void;  
  onAcceptPackingSuggestion: (id: string) \=\> void;  
  onDismissPackingSuggestion: (id: string) \=\> void;

  onStartJournal: (title?: string) \=\> void;  
  onUpdateJournal: (journal: TripJournal) \=\> void;

  onUpdateDayNotes: (dayNumber: number, notes: string) \=\> void;  
  onUpdateDayTitle: (dayNumber: number, title: string) \=\> void;  
  onUpdateDayType: (dayNumber: number, dayType: DayType) \=\> void;  
  onUpdateOvernight: (dayNumber: number, overnight: OvernightStop) \=\> void;

  onAddDayActivity: (dayNumber: number, activity: Activity) \=\> void;  
  onUpdateDayActivity: (dayNumber: number, activityIndex: number, activity: Activity) \=\> void;  
  onRemoveDayActivity: (dayNumber: number, activityIndex: number) \=\> void;  
}

This is still interactive, but the viewer stays dumb because it only renders and emits.

\---

Canonical mutation rules

These rules should be explicit and centralized.

Rule 1

Viewer actions must never directly mutate a local copy of timeline truth.

Rule 2

All accepted changes update canonical source state first.

Rule 3

Every derived display must come from updated canonical truth after mutation.

Rule 4

Print/export must never use a separately patched itinerary model.

Rule 5

If journal references timeline structure, journal rendering must reconcile against canonical timeline, not its own independent route truth.

\---

Changes needed in TripContext

Current TripContext already carries canonicalTimeline, but the surrounding helpers are mixed.

Concerns

Right now:

day activity helpers update summary.days

canonicalTimeline is also present

Step 3 pulls canonicalTimeline from context

reset semantics are not fully aligned

That suggests some truth is split between summary-side updates and canonical-side display.

Improvement target

You need a clearer model for:

what is canonical itinerary truth

what is summary snapshot

whether summary is derived from canonical or parallel to it

where timeline mutations update both structures if both must remain

At minimum:

define canonical mutation entry points

ensure viewer edits go through them

ensure summary and canonical stay synchronized

\---

Printing / export rule

TripPrintView should use canonical truth only.

If it currently relies on looser summary-derived or section-specific display data, tighten it.

Print contract

Print/export should:

read canonical trip state

format that state for output

never re-decide itinerary structure

That keeps print honest and prevents “UI and PDF disagree” bugs.

\---

Migration plan for the kitchen

Phase 1 — Establish the law

Document the single-canonical-timeline rule

Identify current mutation paths touching itinerary/journal/POI state

Decide whether summary is derived from canonical, parallel to it, or co-maintained

Phase 2 — Slim Step 3

Remove deep editing and viewer-specific responsibilities from Step3Content

Keep Step 3 focused on result gate concerns

Introduce explicit “Open Viewer” flow if needed

Phase 3 — Introduce viewer shell

Create TripViewer

Move itinerary/journal/suggestion rendering under viewer

Keep viewer props-only and callback-only

Phase 4 — Centralize canonical mutations

Create controller/hook/helper layer for canonical updates

Route POI add/dismiss and itinerary edits through that layer

Remove ad hoc mutation logic from viewer-facing components

Phase 5 — Align print/export

Ensure print reads canonical truth only

Verify updated plan prints exactly as currently planned

Phase 6 — Clean reset and restore semantics

Ensure reset clears canonical truth consistently

Ensure history restore rebuilds canonical truth rather than just injecting summary fragments

\---

Risks to watch

Risk 1 — Viewer becomes a second god-screen

Avoid by keeping domain logic out of it.

Risk 2 — Summary and canonical drift

If both remain first-class state, you need strict synchronization rules.

Risk 3 — “Dumb viewer” gets violated slowly

Any local itinerary patching inside viewer components should be treated as a regression.

Risk 4 — Print uses stale or alternate structures

Must derive from canonical state every time.

\---

Definition of done

This refactor is done when:

Step 3 only functions as a calculated-results gate

Viewer renders canonical truth and emits intents only

all itinerary-affecting actions mutate canonical source upstream

no shadow itinerary state exists in viewer or print path

print/export matches the real current plan

POI and packing interactions are reflected in canonical timeline updates

reset/restore flows preserve the single-source-of-truth model

\---

Kitchen ticket summary

Main ticket

Refactor Step 3 into Results Gate and move post-calculation interaction into a dumb Viewer driven by single canonical timeline truth.

Why

To preserve one itinerary truth, reduce Step 3 overload, prevent shadow state, and ensure viewer/print/journal all reflect the same updated planned trip.

Expected outcome

Cleaner boundaries, safer editing, honest printing, and a stronger long-term architecture for MEE.
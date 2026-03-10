Kitchen Ticket Order — Smart vs Dumb Separation

North Star

Use this rule for every ticket:

Smart layer

owns orchestration

derives data

talks to services/context/storage

makes decisions

emits shaped props \+ callbacks

Dumb layer

renders what it is given

emits user intent upward

may hold tiny UI-only state

does not own business truth

\---

Course 1 — Step 3 / Viewer boundary reset

Files likely involved

src/components/Steps/Step3Content.tsx

src/components/Steps/Step3TimelineSection.tsx

src/components/Steps/step3-types.ts

src/hooks/usePlanningStepProps.ts

src/contexts/TripContext.tsx

What’s the concern

Step 3 is still acting like:

results gate

itinerary surface

journal surface

suggestion interaction layer

partial controller

That’s too many roles.

Why it’s a concern

This is the biggest conceptual overload zone in the app.  
It makes Step 3 hard to evolve, hard to test, and easy to accidentally turn into the permanent dumping ground.

How to improve

Smart

Create a controller layer:

useStep3ResultsGate()

or useCanonicalTripController()

It should:

pull canonical state

shape summary/health data

provide viewer callbacks

own itinerary-affecting mutations upstream

Dumb

Split presentation into:

Step3ResultsGateView

TripViewer or TripWorkspace

TripViewer should only render and emit intents.

Deliverable

Step 3 becomes the checkpoint.  
Viewer becomes the renderer.  
Canonical truth stays upstream.

\---

Course 2 — Step 1 controller split

Files likely involved

src/components/Steps/Step1Content.tsx

What’s the concern

Step1Content is doing both workflow logic and rendering:

date mode logic

open-ended trip handling

same-day trip logic

import/template behavior

preview derivation

challenge/adventure entry coordination

Why it’s a concern

This is how wizard screens quietly become brittle.  
Any new Step 1 feature now has too many places to accidentally tangle.

How to improve

Smart

Create:

useStep1Controller.ts

Own:

import handling

preview derivations

state interpretation

warning/callout conditions

entry-point orchestration

Dumb

Create:

Step1View.tsx

Render:

fields

labels

callouts

buttons

helper text

Deliverable

Step 1 becomes easier to reason about as:

logic here

presentation there

\---

Course 3 — Location editor separation

Files likely involved

src/components/Trip/Location/LocationList.tsx

What’s the concern

LocationList appears to combine:

list rendering

drag/drop behavior

favorite location interactions

location mutation logic

orchestration around add/remove/reorder

Why it’s a concern

This is a high-interaction surface that may eventually be reused by:

plan mode

template load

fork flows

restore flows

Mixed responsibilities here will get expensive fast.

How to improve

Smart

Create:

useLocationListController.ts

Own:

reorder logic

favorite load/save interactions

mutation handlers

normalized row models

Dumb

Create:

LocationListView.tsx

optional LocationRowView.tsx

Render:

rows

reorder affordances

favorite controls

CTA buttons

Deliverable

Location editing becomes a reusable, controlled workflow instead of one chunky UI brain.

\---

Course 4 — Adventure mode split

Files likely involved

src/components/Trip/Adventure/AdventureMode.tsx

What’s the concern

Adventure mode currently looks like one component doing:

local form state

search/debounce logic

preview math

destination selection behavior

modal rendering

Why it’s a concern

This is a classic modal-controller fusion.  
As adventure mode grows, it becomes harder to change without breaking search logic or UX logic.

How to improve

Smart

Create:

useAdventureModeController.ts

Own:

input state

debounced search

result shaping

preview metrics

selection handling

Dumb

Create:

AdventureModeView.tsx

Render:

modal shell

form

suggestions/results

preview panel

Deliverable

Adventure mode becomes easier to extend without becoming a monolith.

\---

Course 5 — Discovery panel separation

Files likely involved

likely src/components/Trip/Discovery/\*

especially DiscoveryPanel.tsx if present in that area

What’s the concern

Discovery tends to blend:

fetched suggestions

ranking/tiering

time-budget filtering

add/dismiss logic

card rendering

Why it’s a concern

If the panel owns too much decision-making, it becomes the truth-holder for discovery behavior instead of a render surface.

How to improve

Smart

Create:

useDiscoveryController.ts

Own:

filtered/tiered suggestion groups

add/dismiss intent shaping

“add all no-brainers” behavior

route-ordering prep

Dumb

Create:

DiscoveryPanelView.tsx

Render:

sections

sliders/toggles

suggestion cards

buttons

Deliverable

Discovery becomes a controlled feature pipeline instead of UI-first business logic.

\---

Course 6 — Budget input split

Files likely involved

src/components/Trip/Budget/BudgetInput.tsx

What’s the concern

Budget appears to contain both:

display UI

allocation/profile domain logic

Including:

mode switching

weight balancing

adaptive default application

save/apply profile behavior

derived per-person calculations

Why it’s a concern

This is math-heavy domain behavior living close to render code.  
That makes it harder to test and easier to regress.

How to improve

Smart

Create:

useBudgetController.ts

Own:

allocation mode decisions

rebalance rules

derived math

profile actions

expanded state shaping if needed

Dumb

Create:

BudgetInputView.tsx

Render:

sliders

inputs

toggles

profile UI

breakdown sections

Deliverable

Budget logic becomes a clean controller instead of UI-entangled math.

\---

Course 7 — Map as renderer, not policy surface

Files likely involved

src/components/Map/Map.tsx

related map hooks/helpers

What’s the concern

Map components often become accidental brains:

deciding route layer precedence

alternate route decisions

popup derivation

detour math

preview vs canonical rendering rules

Why it’s a concern

Maps are already inherently complex.  
When they also become decision layers, they get hard to trust and hard to debug.

How to improve

Smart

Create or strengthen:

useMapPresentationModel.ts

or extend current map hook layer

Own:

layer derivation

marker models

popup models

route summary data

click behavior shaping

Dumb

Create or preserve:

MapView.tsx

Render:

tiles

layers

markers

popups

controls

Deliverable

Map becomes a faithful visualizer of trip truth, not another truth engine.

\---

Course 8 — Journal timeline split

Files likely involved

src/components/Trip/Journal/\*

especially journal timeline components/hooks

What’s the concern

Journal surfaces can drift into mixing:

stop/day derivation

progress logic

note/photo action shaping

rendering

Why it’s a concern

Journal is a companion feature, and companion features get messy when their display layer quietly becomes their logic layer too.

How to improve

Smart

Create:

useJournalTimelineController.ts

Own:

grouping/derivation

progress calculations

action shaping

journal-ready view models

Dumb

Create:

JournalTimelineView.tsx

Render:

cards

note editors

progress indicators

action controls

Deliverable

Journal becomes easier to evolve without contaminating rendering with domain logic.

\---

Course 9 — Canonical mutation helpers

Files likely involved

likely new files under src/lib or src/hooks

What’s the concern

Even with smart/dumb splits, you can still end up with scattered mutation rules across multiple controllers.

Why it’s a concern

Then you get smart containers that each mutate truth a little differently.

How to improve

Create centralized helpers for canonical updates:

add POI

dismiss POI

update day metadata

update activities

merge packing decisions

Examples:

src/lib/canonical-updates/addPoiToTimeline.ts

src/lib/canonical-updates/updateDayMetadata.ts

src/lib/canonical-updates/updateDayActivities.ts

Deliverable

Smart containers coordinate.  
Canonical helpers decide.  
Dumb components render.

\---

Course 10 — Context slimming

Files likely involved

src/contexts/TripContext.tsx

What’s the concern

A big context can make even well-split components behave poorly if every smart container must subscribe to too much.

Why it’s a concern

Then “smart” components become broader than they should be, because the context itself is broad.

How to improve

Split context by responsibility where useful:

trip core

canonical timeline

trip actions

maybe viewer/session UI state separately

Deliverable

Smart containers subscribe narrowly and stay focused.

\---

Priority Board

Highest ROI

1\. Step 3 / Viewer split

2\. Step 1 split

3\. LocationList split

4\. DiscoveryPanel split

5\. AdventureMode split

Strong next wave

6\. BudgetInput split

7\. Map presentation-model split

8\. JournalTimeline split

Foundation support

9\. Canonical mutation helpers

10\. Context slimming

\---

Quick smell test for future files

Hand this to the kitchen as a standing rule:

A component probably needs smart/dumb separation when it does 2 or more of these:

async calls

data shaping

service/context/storage interaction

business-rule decisions

substantial UI rendering

If it only renders shaped data and emits callbacks, keep it dumb.

\---

Executive summary for the kitchen

Main concern

Several major surfaces are still blending:

orchestration

decision-making

truth mutation

rendering

Why it matters

That makes features harder to test, harder to reuse, and easier to turn into new god-components.

Direction

Move decision-making into controller/hooks/helpers.  
Keep render surfaces mostly dumb.  
Keep canonical truth mutations centralized and upstream.
\---

Large Ticket Order

Ticket 1 — Architecture contract drift

What’s the concern  
Your repo’s written law and actual enforcement are out of sync.

CLAUDE.md says App.tsx has a hard limit of 300 lines and that ESLint enforces it.

eslint.config.js actually enforces 320 lines.

src/App.tsx currently lands at 314 lines.

Why it’s a concern  
This is the kind of drift that slowly weakens a codebase’s discipline.

Once the team sees:

docs say one thing

lint enforces another

code exceeds the stated rule anyway

…then the rule stops being a rule and starts becoming a suggestion.

That matters because your whole repo philosophy is built around guardrails. If the flagship guardrail is already fuzzy, the rest will follow.

How to improve and make it better

Pick one truth:

either 300 is the real rule

or 320 is the real rule

Update both CLAUDE.md and ESLint to match.

If 314 is acceptable for now, make it explicit:

“temporary cap 320, target 300”

Then finish the extraction and get App.tsx under the final number.

Kitchen note  
This is a process integrity ticket, not just a formatting one.

\---

Ticket 2 — Props explosion is still alive, just relocated

What’s the concern  
You already know Step3Content is a known offender, and it still is. But the bigger issue is that the app is solving this by assembling giant prop bundles in hooks, then piping them through giant parent components.

The flow is basically:

App.tsx → usePlanningStepProps → PlanningStepContent → Step3Content

That removes clutter from App, but doesn’t actually reduce coupling.

Why it’s a concern  
This is “debt wearing a nicer shirt.”

Symptoms:

huge interfaces

giant prop surfaces

parent components acting like freight forwarders

harder testing

harder refactors

more accidental rerenders

every new feature wants “just one more prop”

This scales badly because Step 3 is already a mini-application:

estimate mode

feasibility

journaling

POIs

history

commit/confirm flow

overnight prompt

timeline editing

That’s too many responsibilities to be coordinated through a giant prop contract.

How to improve and make it better Refactor by feature slice, not by “move more props to another helper.”

Best path:

Create a useStep3Controller() or useStep3Screen() hook that owns Step 3’s derived state and actions.

Give Step3Content a much smaller API:

screenState

screenActions

or smaller child-specific bundles

Move Step 3-only concerns out of shared planning plumbing.

Consider a dedicated Step 3 context if this area keeps growing.

Kitchen note  
The goal is not “fewer lines in App.”  
The goal is fewer reasons for Step 3 to break when unrelated things change.

\---

Ticket 3 — Single context is doing too much and is not memoized

What’s the concern  
TripContext is carrying a lot:

locations

vehicle

settings

summary

canonical timeline

setters

helper actions

day activity mutations

reset

And the provider value is created inline, not memoized.

Why it’s a concern  
A wide, high-churn context becomes a rerender amplifier.

Even if only one small thing changes, every consumer is now tied to the whole value object’s churn pattern. That becomes more painful as the app grows.

Right now there are only a few consumers, so it hasn’t exploded yet. But this is exactly the sort of foundation problem that bites later when more deep consumers get added.

Also, the context is mixing:

persistent trip state

editing helpers

timeline-specific controls

That’s multiple domains in one bucket.

How to improve and make it better Split by concern:

TripCoreContext

locations, vehicle, settings, summary

TimelineContext

canonicalTimeline \+ timeline mutations

maybe TripActionsContext

mutators only

And memoize provider values with useMemo.

Even better:

expose focused hooks so components subscribe to the smallest slice possible.

Kitchen note  
This is a future-proofing ticket. Fixing it now is easier than after 15 more consumers pile on.

\---

Ticket 4 — Async race protection is partial, not complete

What’s the concern  
useTripCalculation handles some async work carefully, but not all of it.

You do abort background overnight geocoding, which is good.  
But other async updates still fire without versioning/cancellation:

snapFuelStopsToStations(...)

fetchAllRouteStrategies(...)

Those can resolve after a newer calculation or newer interaction and still try to write state.

Why it’s a concern  
This creates “last promise wins” problems.

That’s how you get subtle UI weirdness like:

fuel stops from the wrong route

strategy list from an older calculation

flicker after rapid changes

state that feels haunted instead of broken

These are nasty bugs because they’re timing-dependent and hard to reproduce.

How to improve and make it better Introduce a calculation generation token:

increment calcRunId on each new calculation

when async results resolve, only commit if their run id matches current

For example:

snapFuelStopsToStations

fetchAllRouteStrategies

any other background enrichment

If possible, standardize this into a tiny helper:

runGuardedAsync(runId, promise, applyResult)

Kitchen note  
You already have the right instinct here. This ticket is about finishing the pattern consistently.

\---

Ticket 5 — Reset behavior is inconsistent across the app

What’s the concern  
There are multiple reset paths, and they don’t all mean the same thing.

TripContext.resetTrip() resets:

locations

settings

summary

But it does not reset:

vehicle

canonicalTimeline

Meanwhile useAppReset() performs a broader app reset path.

Why it’s a concern  
This creates semantic drift:

one reset means “clear trip”

another means “really clear trip”

another might mean “clear some things but not others”

That’s dangerous because future code may call the wrong reset and assume everything is clean.

This kind of mismatch produces “why is this old timeline still here?” or “why did this state survive reset?” bugs.

How to improve and make it better Define reset semantics explicitly.

Suggested split:

resetTripDraft()

resetCalculatedTrip()

resetSession()

resetAppMode()

Then make each one intentional and complete.

Also:

either remove TripContext.resetTrip() if it’s not the canonical reset

or make it call the full shared reset pipeline

Kitchen note  
This is a clarity and correctness ticket.

\---

Ticket 6 — Persistence is too eager and storage strategy is getting heavy

What’s the concern  
You’re writing defaults to localStorage on every settings change.

And history storage strips fullGeometry, which is smart, but still stores a pretty chunky TripSummary object.

Why it’s a concern  
Two different issues here:

A) Write amplification

Persisting on every settings change means lots of writes during:

sliders

toggles

budget edits

route preference tweaking

That may not kill the app, but it’s noisy and can become wasteful.

B) Storage shape creep

Even without geometry, trip summaries can still get big:

segments

days

weather

metadata

budget detail

Over time, “history” tends to bloat unless there’s a deliberate lightweight storage model.

How to improve and make it better For settings:

debounce persistence

or persist only the specific fields when they actually change meaningfully

For history:

create a dedicated HistoryTripSnapshot type

store only what history UI truly needs:

origin/destination

date

distance

duration

fuel cost

maybe mode/challenge badge

if loading a recent trip should fully restore it, store a proper resumable model separately from display history

Kitchen note  
Right now this is still manageable. Later it becomes mystery localStorage failures.

\---

Ticket 7 — History loading behavior is underdefined

What’s the concern  
The recent-trips path appears to load a past trip by passing it into setSummary, but that is not the same as restoring a full calculated session.

That means the app may show summary/history data without the rest of the calculation ecosystem being rebuilt:

canonical timeline

strategy state

journal coupling

possibly other calculation-derived state

Why it’s a concern  
This creates an ambiguous UX contract:

Is “Recent Trips” just a card preview?

Is it a soft view-only summary load?

Is it a full trip restore?

Right now it looks like it wants to be “load,” but the plumbing reads closer to “inject a summary object.”

That’s fragile.

How to improve and make it better Choose one of these directions:

Option A — Preview only

Recent trips are read-only snapshots. Clicking them opens a simple details view.

Option B — Full restore

A recent trip restores:

locations

settings

vehicle

summary

timeline

trip mode

anything else needed for true continuity

If Option B, give it a dedicated restore pipeline:

restoreTripSession(snapshot)

Kitchen note  
This is less about code style and more about product truth.

\---

Ticket 8 — Several files are still mixed-responsibility hotspots

What’s the concern  
A number of files are still hovering above or around the repo’s own line-limit philosophy.

Examples:

Step1Content.tsx

BudgetInput.tsx

LocationList.tsx

FlexibleDay.tsx

trip-orchestrator.ts

poi-ranking.ts

adventure-service.ts

stop-suggestions/generate.ts

Map.tsx

These are likely your next debt pressure points.

Why it’s a concern  
Big files are not automatically bad.  
Big files with multiple responsibility types are.

The danger signs are when one file mixes:

derivation logic

rendering

event handlers

formatting

domain rules

persistence

side effects

That’s where change risk spikes.

How to improve and make it better Don’t split by arbitrary file size. Split by responsibility seam.

Examples:

Step1Content

move template import flow into a hook/controller

move date preview and trip-preview derivations into helpers/hooks

Map.tsx

separate route overlays

separate interaction popup layer

separate tile controls

trip-orchestrator.ts

break into phase modules:

route acquisition

summary enrichment

weather enrichment

day splitting

smart stops

canonical timeline assembly

Kitchen note  
This is where your 300-line philosophy should become a design philosophy, not just a lint target.

\---

Ticket 9 — Mount-only hydration has hidden coupling

What’s the concern  
useURLHydration intentionally suppresses exhaustive-deps and runs a complex mount-only effect.

It does a lot:

parse URL state

restore trip state

mark steps complete

force step 3

restore last origin

apply adaptive defaults

apply preset fallback behavior

Why it’s a concern  
This is the kind of effect that works… until the surrounding assumptions change.

Because it’s mount-only and explicitly opts out of dependency tracking, future refactors can silently break the logic without React helping you.

It’s also mixing:

one-time hydration

fallback boot behavior

preference adaptation

wizard state mutation

That’s a lot of boot responsibility in one effect.

How to improve and make it better Split boot logic into explicit phases:

hydrateFromURL()

hydrateFromLastOrigin()

hydrateAdaptiveDefaults()

Then have one mount effect call those pure routines.

That way:

the effect stays small

the boot contract is understandable

future refactors are less fragile

Kitchen note  
This ticket is about making startup behavior legible, not just functional.

\---

Ticket 10 — Some UI patterns are still a little too imperative

What’s the concern  
There are places where styling/interaction still leans a bit imperative rather than declarative. Example: hover styling through direct DOM mutation in recent-trip cards.

There are also pockets of heavier inline-style usage.

Why it’s a concern  
This isn’t a catastrophic issue, but it chips away at consistency:

harder to theme

harder to refactor

less predictable than class/state-driven styling

easier to accidentally diverge visually

In a product this polished, these little imperative patterns start standing out more.

How to improve and make it better

prefer state/class-based hover/focus visuals

centralize reusable card interaction styles

reduce inline style where visual system consistency matters

Kitchen note  
This is a polish ticket, not a structural emergency.

\---

Priority order I’d hand the kitchen

Fire first

1\. Architecture contract drift

2\. Props explosion / Step 3 boundary refactor

3\. Async race protection completion

4\. Reset semantics unification

Then stabilize

5\. TripContext split \+ memoization

6\. History/restore model clarification

7\. Persistence/storage tightening

8\. Hydration cleanup

Then polish

9\. Mixed-responsibility hotspot reductions

10\. Imperative UI cleanup

\---

Bottom-line verdict

MEE’s problem is not “it’s sloppy.”  
MEE’s problem is that it’s becoming successful enough to need stronger internal boundaries.
## Detailed Design Spec — Map as a Story Canvas

## Feature / phase name

**Map as a Story Canvas**

## Purpose

Transform the map from a passive geographic backdrop into an active **narrative stage** for the journey.

The map should not merely show:

* where the trip goes
* where stops are
* what route was chosen

It should help the user feel:

* how the journey unfolds
* what parts were declared
* what parts were inferred
* where the trip breathes
* where the road changes character

The map should behave like:

> “This is the journey becoming visible.”

Not just:

> “Here is the route layer under the UI.”

---

# Product problem

## Current problem

The map is already useful and visually strong, but it can still risk feeling like:

* background context
* a route display surface
* a supporting utility layer beneath the planner

That undersells one of MEE’s biggest differentiators.

An Experience Engine should use the map as:

* a journey stage
* a reveal surface
* a meaning surface
* a trust surface

Right now, without a stronger design language, the map can show the route without fully showing the **story of the trip**.

## Why this matters

The map is one of the highest emotional-value surfaces in the product.

It is where a user can most viscerally feel:

* “yes, this is the trip”
* “yes, the engine understood my route”
* “yes, these stops mean something”
* “yes, the journey has shape”

If the map only visualizes geography, it misses a major opportunity to reinforce the product promise.

---

# Design goal

## Core goal

Make the map feel like the **journey unfolding in space**.

## Experience goal

The user should feel:

* oriented
* intrigued
* confident
* emotionally connected to the trip shape
* able to understand the difference between declared, inferred, and discovered trip elements

## Emotional goal

The map should feel:

* alive
* premium
* restrained
* cinematic when appropriate
* never noisy
* never overloaded

---

# Success criteria

The map is successful when:

* the chosen route feels like the trip’s visual spine
* declared stops feel meaningfully different from inferred ones
* overnight anchors feel important
* discovery suggestions feel optional and exploratory
* timeline interaction and map interaction feel connected
* the map reinforces trip understanding instead of just existing behind the planner
* motion and emphasis support comprehension, not decoration

---

# Core UX concept

The map should communicate **trip meaning**, not just trip geometry.

It should visually distinguish:

1. **The route itself**
2. **Declared trip truth**
3. **Engine-inferred support structure**
4. **Optional discoveries**
5. **Current focus / active context**

The user should be able to look at the map and feel:

* what they explicitly shaped
* what MEE added to support the journey
* what is part of the plan
* what is exploratory

---

# Primary map roles

## Role 1 — Journey spine

The route should be the primary visual backbone.

## Role 2 — Meaning surface

Stops and anchors should communicate type and importance.

## Role 3 — Focus guide

The map should help the user understand what part of the trip is currently active or selected.

## Role 4 — Reveal surface

The map should contribute to the feeling of trip arrival when results are revealed.

---

# Map states

The map should behave differently depending on app state.

## State A — Pre-trip / setup

### Purpose

Provide orientation and atmosphere without overcommitting to a trip that doesn’t exist yet.

### Behavior

* map remains alive beneath the planning UI
* route is absent or minimal until enough route truth exists
* geographic context supports the planning mood
* no heavy marker clutter

### Design goal

The map should feel like:

> “the road is waiting”

Not like:

> “here is empty logistics space”

---

## State B — Route shaping / planning

### Purpose

Show route formation as the trip takes shape.

### Behavior

* once origin/destination exist, route can become visible
* once stops are added, route updates clearly
* declared stops appear with distinct styling
* passive waypoints remain lower-emphasis

### Design goal

The user should feel:

> “I am shaping the road”

Not:

> “the app is just drawing lines because I typed something”

---

## State C — Results reveal

### Purpose

Turn the map into a reveal surface when the trip is built.

### Behavior

* route should arrive intentionally
* declared points should read as anchors
* inferred support stops may appear after route reveal
* overnight anchors should feel like major beats
* discovery suggestions should remain secondary until invited in

### Design goal

The user should feel:

> “The journey is now real.”

---

## State D — Viewer / active trip workspace

### Purpose

Support deeper trip inspection and navigation of the journey.

### Behavior

* map responds to timeline focus
* selected stops / segments highlight gracefully
* active context is clear
* exploratory and supporting elements remain legible but secondary

### Design goal

The user should feel:

> “The map and the trip are talking to each other.”

---

# Visual category system

The map must distinguish key trip element types.

## Category 1 — Route path

### Meaning

The actual trip path / selected route.

### Role

This is the map’s primary visual backbone.

### Visual guidance

* strongest continuous line on the map
* premium but restrained
* must remain readable at all zoom levels
* should visually outrank secondary path overlays

### Guardrails

* no excessive decorative glow
* route must be readable before it is stylish
* keep it visually clean and confident

---

## Category 2 — Declared stops

### Meaning

Stops explicitly declared by the user:

* fuel
* meal
* overnight
* declared route anchors

### Role

These represent user-authored truth.

### Visual guidance

* stronger, more anchored styling
* clearly intentional
* should feel “claimed” by the trip
* distinct from passive or inferred points

### Possible treatment direction

* stronger fill/border contrast
* more prominent iconography
* slightly larger visual weight than inferred stops
* clearer label treatment when selected

### Guardrails

* declared stops must always visually outrank inferred stops
* do not make them look decorative; they should feel reliable

---

## Category 3 — Engine-inferred support stops

### Meaning

Stops MEE introduced or interpreted for viability:

* fuel support
* timing support
* engine-estimated route rhythm stops

### Role

These represent engine intelligence, not user authorship.

### Visual guidance

* softer system styling
* lower visual weight
* still clear and trustworthy
* should feel helpful, not dominant

### Possible treatment direction

* lighter opacity or softer borders
* subtler marker treatment
* lower emphasis unless focused

### Guardrails

* inferred stops must not compete with declared stops
* do not make them look hidden or unimportant; they still matter

---

## Category 4 — Overnight anchors

### Meaning

Major rest or hotel points that shape the trip’s day boundaries.

### Role

These are structural anchors in the journey.

### Visual guidance

* elevated importance
* distinct from ordinary stops
* should feel like chapter markers in the trip

### Possible treatment direction

* special icon treatment
* stronger emphasis than ordinary stops
* visible enough to be understood at a glance

### Guardrails

* overnight anchors should read as major beats, not just another point

---

## Category 5 — Discovery / enrichment suggestions

### Meaning

Optional POIs, discoveries, nearby ideas, scenic enrichments.

### Role

These are exploratory and optional.

### Visual guidance

* inviting
* curious
* optional-feeling
* clearly not part of the canonical trip unless accepted

### Possible treatment direction

* lighter accent category
* optional marker feel
* visually differentiated from declared and inferred trip structure

### Guardrails

* discoveries must never visually overpower the actual trip
* they should feel tempting, not mandatory

---

## Category 6 — Active selection / current focus

### Meaning

The thing the user is currently inspecting:

* selected stop
* selected day
* selected timeline event
* active route segment

### Role

This is the immediate attention layer.

### Visual guidance

* strongest temporary emphasis
* must be visually clear and reversible
* should feel connected to the viewer/timeline state

### Possible treatment direction

* focused route segment highlight
* stronger selected marker state
* subtle map camera/focus response
* clear active halo or emphasis treatment

### Guardrails

* active selection should not permanently distort map meaning
* focus states must remain elegant, not noisy

---

# Route reveal behavior

## Purpose

Make the first appearance of the built route feel intentional and premium.

## Trigger

Trip calculation completes successfully.

## Behavior

* the route should reveal with calm confidence
* declared anchors should settle into place in a readable sequence
* secondary map elements should not all appear at once in a clutter burst

## Recommended choreography

1. route path appears
2. primary anchors settle in
3. secondary support elements appear
4. optional discovery remains subdued until invoked

## Design goal

The reveal should feel like:

> “Here is the road you built.”

Not:

> “all markers loaded”

## Guardrails

* no gimmicky swooshes
* no excessive duration
* no busy choreography that hurts comprehension
* motion should support narrative order

---

# Timeline ↔ map linkage

## Purpose

Connect trip understanding across surfaces.

The map should respond meaningfully when the user interacts with:

* timeline items
* day sections
* stops
* viewer states

## Behavior

### When a timeline item is selected

* corresponding stop or route segment highlights
* map focus adjusts gracefully if needed
* related marker becomes visually active

### When a day is selected

* that day’s route portion becomes clearer
* overnight anchor and key stops for that day gain emphasis

### When a stop is selected on the map

* corresponding trip panel / timeline element should become contextually clear

## Design goal

The user should feel:

> “These are two views of the same journey.”

## Guardrails

* no jarring map jumps
* no over-eager camera movement
* focus transitions should feel intentional and calm

---

# Camera / viewport behavior

## Purpose

Support understanding without causing motion fatigue or loss of context.

## Default principles

* prioritize clarity over dramatic movement
* preserve geographic context where possible
* only reposition when it meaningfully improves comprehension

## Acceptable behaviors

* fit route on reveal
* gentle recenter when major trip context changes
* modest zoom/focus adjustment for selected trip elements
* maintain broad context when possible

## Guardrails

* do not recenter constantly
* do not zoom so aggressively that the trip loses context
* do not treat every click as a camera event

---

# Labeling / annotation behavior

## Purpose

Help the map communicate meaning without becoming text-heavy.

## Labels should support

* key declared anchors
* overnight points
* active selection
* optional discovery context when needed

## Rules

* labels must remain sparse
* only the most meaningful elements should be labeled persistently
* other text should appear contextually on selection or focus

## Good persistent candidates

* destination
* overnight anchors
* major declared stop(s)

## Good contextual candidates

* inferred support stops
* discovery suggestions
* segment-specific details

---

# Interaction model

## Map interactions should support

* understanding
* exploration
* confirmation
* sense of place

## Map should not become

* visually overloaded control surface
* dominant source of every trip interaction
* competing truth layer separate from the viewer

## Rule

The map is a story canvas and focus surface, not a second planner form.

---

# Content / tone support

The map itself should remain light on text, but surrounding UI and map legends/popovers should reinforce category meanings consistently.

## Category wording examples

* `Declared stop`
* `Engine-estimated stop`
* `Overnight anchor`
* `Nearby discovery`
* `Active segment`

## Guardrails

* use consistent wording across the app
* do not invent new labels per surface
* keep category language concise and calm

---

# Mobile considerations

## Goal

Keep the map emotionally effective and legible without overwhelming the smaller screen.

## Mobile priorities

* route clarity first
* selected item clarity second
* avoid too many simultaneous categories at full prominence
* use progressive disclosure for optional discovery

## Rules

* fewer persistent labels
* stronger simplification of visual states
* keep focus transitions subtle

---

# Desktop considerations

## Goal

Use the larger canvas to deepen story and context.

## Desktop opportunities

* richer route reveal
* clearer simultaneous understanding of route + trip panel
* stronger visual distinction between stop categories
* more visible day or segment focus

## Rules

* still maintain restraint
* larger screen is not permission for clutter

---

# Accessibility / legibility principles

## Purpose

Ensure the map remains understandable, not just beautiful.

## Requirements

* important categories must not rely on color alone
* marker categories should have shape/icon/state differentiation where possible
* selected/active states must be clearly distinct
* route visibility must remain strong in varied map conditions

## Guardrails

* decorative styling must never reduce functional clarity
* the route should remain readable under dark/glass UI conditions

---

# Canonical truth rules

The map must render from the same trip truth used elsewhere.

It must not:

* invent alternate stop meaning
* show a materially different trip than the viewer or print
* promote discoveries into the trip unless accepted upstream
* blur declared and inferred categories inconsistently

The map is a visualization surface for trip truth, not a second interpretation engine.

---

# Edge cases

## Minimal trip

If a trip has few stops:

* keep the map clean
* don’t force category complexity that isn’t there

## High-stop trip

If many stops exist:

* prioritize route clarity
* simplify label density
* preserve active context readability

## No discoveries enabled

Map should still feel rich through trip structure alone.

## Heavy inferred logic

If the engine added many support stops:

* they must remain visibly secondary to declared truth

---

# Guardrails

## Must not do

* overload the map with too many simultaneous visual treatments
* let discovery clutter overpower the route
* make every interaction trigger camera drama
* visually flatten declared, inferred, and discovered elements into one category
* treat the map as decorative wallpaper only

## Must do

* make the route feel like the trip spine
* let declared truth feel anchored
* make inferred support legible but secondary
* make the map and timeline feel connected
* preserve premium restraint

---

# Definition of done

This spec is done when:

* the route feels like the visual backbone of the journey
* declared, inferred, discovered, and overnight elements are visually distinguishable
* route reveal feels intentional and calm
* active timeline/viewer focus has a meaningful map response
* the map helps tell the story of the trip instead of just displaying geometry
* the surface remains readable, elegant, and controlled

---

# Kitchen shorthand

## Problem

The map currently risks functioning as a beautiful geographic utility layer instead of a true narrative surface.

## Goal

Turn the map into a story canvas that communicates route meaning, trip structure, and focus with premium clarity.

## Outcome

A map that makes the journey feel visible, collaborative, and emotionally legible — without losing functional trust.

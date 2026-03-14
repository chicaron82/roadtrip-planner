## Detailed Design Spec — Step 1 as a Trip Intent Surface

## Feature / phase name

**Step 1 — Trip Intent Surface**

## Purpose

Transform Step 1 from a traditional setup form into the place where the user **declares the shape, rhythm, and meaning of the journey**.

This step should make the user feel like they are:

* shaping the trip
* teaching MEE what matters
* giving the engine better truth
* authoring the road experience

Not merely filling in route inputs.

---

# Product problem

## Current problem

Step 1 still risks feeling like:

* origin field
* destination field
* date input
* waypoint list
* stop controls

That works functionally, but it undersells the product.

MEE is not just collecting logistics.
It is collecting:

* trip intent
* stop meaning
* pacing hints
* declared user truth vs engine inference

So if Step 1 feels like a generic planner form, the product promise weakens immediately.

## Why this matters

Step 1 is now more important than before because it is the source of truth for:

* route shape
* declared stops
* dwell expectations
* trip title
* manual vs engine-inferred rhythm

That makes Step 1 the **journey-authorship gateway**.

If it feels too technical, too dense, or too form-like, MEE starts the experience in the wrong emotional register.

---

# Design goal

## Core goal

Make Step 1 feel like:

> “Tell MEE what kind of journey this is.”

The user should leave Step 1 feeling:

* understood
* in control
* not overwhelmed
* like the engine now has the right truth to work from

## Experience goal

Step 1 should feel:

* premium
* clear
* intentional
* structured
* not crowded
* not spreadsheet-like

---

# Success criteria

Step 1 is successful when:

* the user immediately understands the step is about **trip shaping**, not just route entry
* origin/destination feel foundational, not like generic fields
* stops/waypoints feel meaningful, not like loose pins
* declared stop roles feel intentional and useful
* manual vs inferred behavior is visually understandable
* the screen stays airy even though it captures richer input
* users can move quickly if they want, but can add richer truth if they care

---

# Core UX concept

Step 1 should be structured around **journey framing**, not generic form sections.

## Recommended section order

### Section 1 — Where the road begins

Purpose: establish the trip’s starting point.

### Section 2 — Where it’s taking you

Purpose: establish destination and unlock the journey identity.

### Section 3 — Name this journey

Purpose: give the trip a human identity once destination is known.

### Section 4 — What happens along the way

Purpose: let the user define meaningful stops and route rhythm.

### Section 5 — When this journey happens

Purpose: lock timing and date intent.

This order supports a natural story:

* start
* destination
* identity
* along-the-way meaning
* timing

---

# Detailed section spec

## Section 1 — Where the road begins

### Purpose

Capture origin in a way that feels like the opening point of a journey.

### Content

* Origin input
* origin helper if needed
* optional “use my current location” / favorite origin affordance if already part of product

### Labeling

Preferred label:
**Where the road begins**

Field label:
**Starting point**

Avoid plain “Origin” as the primary visible section heading.
It can still appear in field-level assistive text if needed.

### Visual treatment

* Clean, prominent first section
* one strong input
* enough breathing room
* no clutter around it

### Behavior

* user enters origin
* origin becomes part of canonical route truth
* no extra drama or extra options before it’s needed

### Guardrails

* do not overload this area with multiple helper blocks
* do not bury the main input under decorative copy

---

## Section 2 — Where it’s taking you

### Purpose

Capture destination as the emotional anchor of the journey.

### Content

* Destination input
* optional destination suggestion/search behavior
* helper text only if useful

### Labeling

Section heading:
**Where it’s taking you**

Field label:
**Destination**

### Visual treatment

* destination should feel slightly more emotionally weighted than origin
* once selected, this section becomes the key unlock for the rest of the trip identity

### Behavior

Once a valid destination exists:

* trip title field becomes available
* route-shaping identity begins to feel real
* destination display name becomes available for fallback title and later surfaces

### Guardrails

* use friendly destination display names
* do not show full geocoder strings as user-facing anchors

---

## Section 3 — Name this journey

### Purpose

Turn the route into a named trip.

### Trigger

This section appears once destination is valid.

### Content

* editable trip title input
* helper text
* optional small status badge indicating:

  * Auto title
  * Custom title

### Labeling

Section heading:
**Name this journey**

Field label:
**Trip title**

Helper text:
**Give this journey a name, or let MEE title it for you.**

### Default behavior

Default auto title:
**Your MEE time in [destination]**

Examples:

* Your MEE time in Thunder Bay
* Your MEE time in Vancouver

### Custom behavior

If user edits title:

* title becomes custom
* future destination changes do not overwrite it

### Visual treatment

* this should feel like a premium authorship moment, not an advanced setting
* it should feel lightly celebratory, not loud
* give the field more room than a normal form input

### Guardrails

* no full geocoder strings
* no auto-overwriting after user edits
* no surface should invent a different title later

---

## Section 4 — What happens along the way

### Purpose

Let the user declare the route rhythm and stop meaning.

This is the heart of Step 1 as an intent surface.

### Content

* waypoint/stop list
* add stop action
* each stop row/card includes:

  * location
  * stop role/intents
  * dwell time
  * optional contextual copy
  * remove/edit/reorder controls if supported

### Section heading

**What happens along the way**

Optional supporting text:
**Declare key stops, or leave them open and let MEE infer the rhythm.**

### Stop row design goal

Stops should feel like **route objects with meaning**, not just list items.

Each stop should visually communicate:

* is this just a route anchor?
* is this a declared stop?
* is this fuel?
* meal?
* overnight?
* mixed-use stop?
* engine should infer?

---

# Stop row / stop card detailed spec

## Stop content model

Each stop row/card should support:

### A. Location

* main location input/display
* remains the anchor of the row

### B. Stop role / intent

Role chips or toggles:

* Fuel
* Meal
* Overnight

These should feel tactile and intentional.

### C. Dwell time

* visible when role is declared
* auto-filled using intent defaults
* editable by user

### D. Optional helper state

Examples:

* “Fuel defaults to 15 min”
* “Meal defaults to 45 min”
* “Overnight shapes day planning downstream”
* “No role selected — MEE will infer how this stop is used”

---

# Stop role behavior

## If no role is selected

Interpretation:

* this is a waypoint / passive route anchor
* MEE will infer stop meaning if needed

### UI treatment

* visibly softer than declared stop roles
* optional subtle label:
  **Engine will infer**
  or
  **Waypoint only**

## If role is selected

Interpretation:

* user is explicitly teaching MEE what this stop is for

### UI treatment

* stronger visual styling
* clearer intent chips
* optional label:
  **Declared stop**

---

# Dwell time behavior

## Default values

* Fuel = 15 minutes
* Meal = 45 minutes
* Overnight = handled differently depending on product rules, but still clearly declared

If multiple roles are selected, default dwell should follow defined product logic.

## Manual override

User can edit dwell time.

### UI expectations

* auto-default should be helpful, not rigid
* user should understand it is editable
* dwell input should not feel like a hidden advanced setting

## Suggested microcopy

* “Auto-filled from stop role”
* “Adjust if needed”

---

# Manual vs inferred clarity

## Purpose

Users should understand what they explicitly declared versus what MEE will decide.

## Visual distinction

### Declared stops

* stronger chips/borders
* clearer labels
* more anchored visual weight

### Inferred / passive stops

* softer styling
* less visual dominance
* optional helper copy

## Rule

Do not let inferred/undecorated waypoints look equally “authoritative” as declared intent stops.

---

# Stop row interaction rules

## Add stop

Should feel like:

* adding a meaningful route point
  not
* adding another generic form row

Suggested CTA text:

* **Add a stop**
* **Add a waypoint**
* **Add a meaningful stop** only if not too wordy

Preferred simple version:
**Add a stop**

## Remove stop

* keep obvious but not visually noisy
* destructive affordance should be secondary

## Reorder stop

If drag/reorder exists:

* keep it quiet
* let the route meaning stay visually primary

---

## Section 5 — When this journey happens

### Purpose

Capture schedule/timing in a way that supports the journey without making this section feel cold.

### Content

* departure date
* return date / trip end behavior
* same-day vs multi-day logic if relevant
* any existing date mode behavior

### Labeling

Section heading:
**When this journey happens**

### Visual treatment

* clean and calm
* less emotionally weighted than destination/intent sections
* should feel like “lock in the trip timing,” not like admin

### Guardrails

* keep date complexity controlled
* do not visually compete with the stop-intent section
* maintain breathing room even if conditional controls appear

---

# Layout and hierarchy spec

## Overall layout goals

* one clear primary flow from top to bottom
* generous vertical rhythm
* no “dense form wall” feeling
* no multiple competing visual heroes
* Step 1 should feel composed, not busy

## Visual hierarchy order

1. Section headings
2. core route inputs
3. trip title
4. stop intent cards
5. timing controls
6. helper text
7. secondary utility actions

## Breathing room rules

* each major section should have clear separation
* stop rows/cards should not collapse into cramped utility rows
* helper text must not stack into visual noise

---

# Content and tone spec

## Tone

* warm
* premium
* calm
* lightly editorial
* never chatty

## Good copy examples

* “Tell MEE what happens along the way.”
* “Give this journey a name.”
* “Declare key stops, or let the engine infer the rhythm.”
* “Shape the road ahead.”

## Avoid

* robotic planner language
* overly cute assistant voice
* too much explanation at once
* technical jargon in visible UI

---

# State rules

## Canonical truth expectations

Step 1 must write upstream trip truth for:

* origin
* destination
* destination display name
* trip title + title mode
* stop list
* stop role/intents
* dwell minutes
* timing/date selections

## Important rule

Step 1 captures truth.
It does **not** become responsible for:

* final itinerary construction
* driver scheduling decisions
* overnight timeline generation
* downstream trip assembly logic

It is an **intent source**, not the itinerary engine.

---

# Visual category rules

These should be supported in Step 1 even before broader app rollout:

## Declared

User explicitly set stop intent.

## Inferred

No stop role selected; engine will decide.

## Auto title

Default title still active.

## Custom title

User-authored title active.

Use these labels consistently if exposed.

---

# Edge cases

## Destination changes before custom title

Auto title updates accordingly.

## Destination changes after custom title

Custom title remains unchanged.

## Stop with no role selected

Still valid as waypoint/anchor.

## Stop with role selected but unchanged dwell

Use auto-default and mark as such quietly.

## Stop with manually edited dwell

Preserve edited value and do not auto-reset casually.

---

# Guardrails

## Must not do

* turn Step 1 into a dense settings wall
* make stop intent controls feel like debug options
* make trip title feel like a hidden advanced field
* let the section hierarchy flatten into one long blob
* let Step 1 start performing downstream itinerary logic

## Must do

* preserve emotional framing
* keep route truth collection clear
* make declared intent legible
* keep the experience airy and premium

---

# Definition of done

This spec is done when:

* Step 1 visually reads as journey authorship, not generic setup
* destination unlocks a proper trip-title moment
* stop rows feel meaningful and typed
* declared vs inferred is visually understandable
* dwell defaults feel helpful and editable
* the screen remains calm and breathable
* Step 1 clearly captures upstream truth without becoming itinerary logic

---

# Kitchen shorthand

## Problem

Step 1 still risks feeling like a standard planner form, which weakens the Experience Engine promise.

## Goal

Reframe Step 1 as the place where users declare the shape and rhythm of the journey.

## Outcome

A more premium, authored, emotionally aligned first step that gives MEE better trip truth and gives users a stronger sense of shaping the road.
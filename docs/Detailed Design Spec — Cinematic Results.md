## Detailed Design Spec — Cinematic Results Reveal

## Feature / phase name

**Results Reveal — Trip Arrival Moment**

## Purpose

Transform the moment after trip calculation from a standard “results loaded” state into a **layered reveal of a journey**.

The user should feel that MEE has:

* understood the trip
* interpreted the trip
* built the trip
* and is now presenting it with confidence

This moment should feel like the engine is saying:

> “Here’s the journey I built with you.”

Not just:

> “Calculation complete.”

---

# Product problem

## Current problem

Many planning tools — even good ones — treat results like a data dump:

* route data appears
* stats appear
* itinerary appears
* user is expected to parse it all immediately

That works functionally, but it weakens emotional payoff.

For MEE, this is especially costly because the engine is doing more than route math. It is interpreting:

* stop intent
* pacing
* driver rhythm
* overnight patterns
* route viability
* trip style

If the reveal is flat, MEE’s value feels smaller than it really is.

## Why this matters

The post-calculation moment is one of the most important trust and delight surfaces in the entire app.

It is where the user decides:

* whether the engine “got it”
* whether the trip feels coherent
* whether the product feels premium
* whether MEE feels like an Experience Engine or just a planning calculator

If this moment is too abrupt, too dense, or too generic, the trip feels less authored.

---

# Design goal

## Core goal

Make the trip completion moment feel like a **journey reveal**, not an API return.

## Experience goal

The user should feel:

* rewarded for the inputs they gave
* confident the engine understood them
* guided into the trip shape before being asked to manage details
* impressed by the clarity and tone of the output

## Emotional goal

The reveal should feel:

* premium
* calm
* cinematic
* confident
* not melodramatic
* not gimmicky

---

# Success criteria

The reveal is successful when:

* the user immediately understands the high-level shape of the trip
* the trip has a clear identity before the details appear
* the engine’s interpretation feels visible
* the information hierarchy feels paced, not dumped
* the user knows what to do next without the screen feeling utilitarian
* the reveal feels like a meaningful product moment worth keeping

---

# Core UX concept

The reveal should happen in **three layers**:

## Layer 1 — Trip identity

Answer:

> “What trip did MEE build?”

## Layer 2 — Trip shape

Answer:

> “How does this journey work?”

## Layer 3 — Next actions

Answer:

> “What can I do with it now?”

This layered structure is essential.
Do not collapse all three into one dense screen wall.

---

# Results reveal flow

## Trigger

The reveal begins when trip calculation completes successfully.

### Preconditions

* trip truth has been finalized upstream
* canonical timeline exists
* summary exists
* supporting health / driver / overnight info exists
* the trip is in a renderable state

## Transition behavior

The shift from loading → reveal should feel deliberate.

### Preferred behavior

* loading resolves
* reveal enters with a clear primary visual anchor
* the trip “lands” rather than abruptly appearing all at once

### Design tone

* polished
* calm
* lightweight motion if used
* no cheap celebration effects
* no excessive animation

---

# Layer 1 — Trip identity

## Purpose

Give the user the emotional and conceptual answer to:

> “What is this trip?”

This is the most important layer.

## Required content

Layer 1 should include:

* trip title
* route framing
* trip read sentence
* key trip stats
* trip mode
* dates

## Recommended content block order

### A. Primary title

Use canonical trip title.

Examples:

* `Lake Superior Escape`
* `Your MEE time in Thunder Bay`

### B. Supporting subtitle

Use MEE framing and dates.

Examples:

* `Your MEE time in Thunder Bay · Sep 12–15`
* `Built by MEE · Sep 12–15`

### C. Route framing

Show the route clearly but secondary to title.

Examples:

* `Winnipeg → Thunder Bay`
* mini route ribbon or route line

### D. Trip Read sentence

One short editorial interpretation of the trip.

Examples:

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Comfort-first pacing with clean shared-driver support.`
* `Efficient and easy to hand off, with low stop pressure.`

### E. Core metrics

Only the most important high-level metrics:

* total distance
* total drive time
* nights
* rooms
* trip mode

Keep this concise.

---

# Layer 1 visual spec

## Visual role

This should be the **hero surface** of the reveal.

## Hierarchy

1. Trip title
2. Subtitle
3. Trip read sentence
4. Core metrics
5. Route framing

## Layout guidance

* give this block breathing room
* do not let stats visually overpower the title
* do not lead with small utility labels
* the user should feel “trip first, numbers second”

## Tone

* premium
* composed
* cinematic
* elegant
* not loud

## Guardrails

* one hero block only
* do not pair it with multiple competing summary cards at equal weight
* avoid leading with giant tables or side-by-side clutter

---

# Layer 2 — Trip shape

## Purpose

Show how the journey works without immediately overwhelming the user with every possible detail.

This answers:

> “How is this trip structured?”

## Required content

Layer 2 should include:

* canonical timeline preview or summary
* trip health summary
* driver distribution snapshot
* overnight shape
* declared vs inferred understanding where relevant

## Recommended content order

### A. Timeline preview

Not full management mode yet — a readable shape preview.

This can include:

* day count
* major stop anchors
* overnight markers
* key declared stops
* natural route rhythm

### B. Trip health / viability

Examples:

* balanced
* ambitious but manageable
* comfort-first
* heavy driving pressure
* smooth shared driving

This should read like interpretation, not warning spam.

### C. Driver snapshot

If driver rotation is relevant:

* show simple summary
* avoid dropping into deep schedule complexity here

Examples:

* `4 drivers, evenly shared`
* `2 drivers, longer outbound legs`

### D. Overnight summary

Examples:

* `2 nights in Thunder Bay`
* `Overnight anchor set at Dryden`
* `Comfort-first split with one overnight reset`

## Optional content

* strategic stop note
* notable declared stop summary
* route mode summary

---

# Layer 2 visual spec

## Visual role

This is the “under the hood, but still elegant” layer.

## Layout guidance

* more structured than Layer 1
* still should not feel like a dense dashboard
* use grouped blocks or sections
* timeline preview should likely anchor this layer

## Hierarchy

1. Timeline shape
2. Health summary
3. Driver / overnight summaries
4. Secondary route notes

## Guardrails

* do not dump all details from the viewer here
* do not show every itinerary event in the hero reveal layer
* do not visually compete with Layer 1’s title block

---

# Layer 3 — Next actions

## Purpose

Once the user understands the trip, show what they can do next.

This answers:

> “What do I want to do with this journey now?”

## Required actions

Depending on feature availability:

* Open Viewer
* Start / Continue Journal
* Print / Export
* Share / Save
* Explore Discovery / Enrichments
* Recalculate / refine if needed

## UX principle

Actions should feel like **next chapters**, not admin buttons.

The primary action should be obvious.

## Recommended priority

### Primary

* `Open Trip Viewer`
  or equivalent

### Secondary

* `Print / Export`
* `Start Journal`
* `Explore Along the Way`

### Tertiary

* recalculation or fine-tuning actions

---

# Layer 3 visual spec

## Visual role

This is the action bridge from reveal → deeper trip interaction.

## Layout guidance

* grouped beneath or beside Layer 2 depending on screen size
* clear primary action
* supporting actions visually calmer
* no big toolbar blob

## Guardrails

* do not visually overpower the reveal with too many action buttons
* no more than one clearly primary CTA
* keep the progression feeling intentional

---

# Information hierarchy rules

## Rule 1 — identity before management

Users should meet the trip before being asked to operate on it.

## Rule 2 — interpretation before detail overload

The reveal should explain the trip’s shape before exposing all controls.

## Rule 3 — trip first, system second

The trip is the hero.
The engine is the guide.
The controls come after.

## Rule 4 — no equal-weight chaos

Not every block deserves equal visual emphasis.

---

# Trip Read sentence spec

## Purpose

Give MEE a consistent editorial summary sentence that interprets the trip.

## Requirements

* one sentence
* concise
* readable at a glance
* no fluff
* should feel like MEE understands the journey

## Good examples

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `A smooth shared-driver run with low stop pressure.`
* `Comfort-first pacing with a clean overnight rhythm.`
* `An efficient route that still leaves room to breathe.`

## Bad examples

* anything too long
* anything too cute
* anything that sounds like chat
* anything vague like “Looks great!”
* anything that repeats raw metrics instead of interpreting them

## Placement

Always in Layer 1, beneath the title/subtitle.

---

# Content and tone spec

## Tone

* premium
* calm
* editorial
* confident
* concise

## What the reveal should sound like

A smart roadtrip editor with taste.

## Avoid

* sterile calculator language
* assistant chatter
* fake hype
* jargon-heavy labels
* over-explaining what the engine did

---

# Motion / transition guidance

## Purpose

Support the feeling of arrival without slowing the user down.

## Acceptable motion

* route reveal
* hero card fade/slide in
* staggered block reveal
* subtle focus shift from loading to title

## Motion rules

* motion must support hierarchy
* motion must not become the centerpiece
* no “celebration animation”
* no excessive delay before usability returns

## Performance rule

Reveal must still feel snappy.
Premium does not mean slow.

---

# Visual hierarchy and layout guidance

## Desktop

Suggested layout:

* Layer 1 hero block prominent at top
* Layer 2 structured beneath or adjacent
* Layer 3 clear CTA area after the trip shape is understood

## Mobile

Suggested order:

1. Layer 1 hero
2. Layer 2 shape
3. Layer 3 actions

Do not try to cram all layers side-by-side on small screens.

## Breathing room

* hero block gets the most space
* trip read sentence must not get cramped
* timeline preview should not visually crowd metrics
* actions should feel like a next step, not a footer dump

---

# Declared vs inferred behavior in results reveal

## Purpose

The reveal should subtly communicate what MEE understood from the user and what it inferred.

## Where to show this

Layer 2, not Layer 1.

Examples:

* `Declared Dryden reset stop`
* `Engine-estimated fuel support`
* `Suggested handoff rhythm`

## Rules

* declared user truth should visually outrank engine inference
* this distinction should support trust, not clutter the hero

---

# Error / edge-case guidance

## If calculation succeeded but trip health is mixed

Still reveal the trip cleanly, but let health language reflect it.

Examples:

* `Ambitious, but workable with shared drivers.`
* `A long push best treated as a comfort-first route.`

Do not let warnings hijack the whole reveal unless truly necessary.

## If there is minimal itinerary complexity

For simpler trips, keep Layer 2 lighter rather than forcing density.

## If there is no custom title

Use the canonical auto title cleanly and do not make it feel second-class.

---

# Canonical truth rules

The reveal must render from canonical trip truth.

It must not:

* invent a different title
* recalculate different trip framing
* generate alternative stop interpretations that differ from canonical output
* treat print/viewer/history as different truth sources

The reveal is a presentation of finalized truth, not a reinterpretation engine.

---

# Guardrails

## Must not do

* dump everything at once
* lead with dense system detail
* use generic “results loaded” patterns
* allow controls to visually overpower the trip identity
* flatten title, stats, and actions into one equal-weight layout

## Must do

* give the trip a clear arrival moment
* establish title and trip read first
* show shape before management
* make next actions obvious but secondary to understanding the journey

---

# Definition of done

This spec is done when:

* successful calculation reveals the trip in layered fashion
* the user first sees trip identity, then trip shape, then actions
* a trip read sentence exists and feels purposeful
* the reveal feels premium and authored
* the layout is paced, not dumped
* the trip feels built, not merely returned

---

# Kitchen shorthand

## Problem

The current results moment risks feeling like a standard planner result instead of a meaningful journey reveal.

## Goal

Create a layered, premium reveal that makes the trip feel interpreted, coherent, and emotionally legible before dropping the user into management surfaces.

## Outcome

A stronger payoff moment that reinforces MEE as an Experience Engine, not just a route calculator.

If this is the level you want, next I’ll do **Spec 3 — Signature Premium Trip Summary Card** in the same deep format.

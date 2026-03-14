## Detailed Design Spec — Signature Premium Trip Summary Card

## Feature / phase name

**Signature Premium Trip Summary Card**

## Purpose

Create one primary summary object that acts as the **cover page of the journey**.

This card should become the most recognizable summary surface in MEE:

* emotionally legible
* visually premium
* useful at a glance
* worthy of screenshots
* reusable across key surfaces

The card should make the user feel:

> “This is my trip.”

Not:

> “Here are several stats and some route data.”

---

# Product problem

## Current problem

Trip information is often scattered across multiple UI surfaces:

* title in one place
* stats in another
* route framing elsewhere
* health in a separate block
* trip identity diluted by too many equal-weight cards

That weakens the emotional payoff of the engine’s work.

Even when the information is all there, the trip can still feel like:

* output fragments
* dashboard modules
* utility summaries

instead of:

* a named journey
* a coherent trip object
* a premium artifact

## Why this matters

MEE needs one summary surface that instantly communicates:

* what this trip is
* how it feels
* what kind of journey it became
* why it matters

This card is a major opportunity to reinforce:

* product identity
* premium positioning
* authorship
* trust
* clarity

It should feel like the engine’s best first impression after the trip is built.

---

# Design goal

## Core goal

Create a single summary card that feels like the **hero cover** of the trip.

## Experience goal

The user should feel:

* oriented immediately
* proud of the trip
* confident in the shape of the route
* excited to explore further

## Emotional goal

The card should feel:

* premium
* calm
* intentional
* composed
* not cluttered
* not dashboard-y

---

# Success criteria

The card is successful when:

* the user can understand the trip at a glance
* the title feels like the hero
* the route is clear without dominating
* the most important metrics are visible but secondary
* the card feels like a journey object, not a metric board
* it can anchor results, viewer entry, and print cover logic
* it feels distinctively MEE

---

# Core UX concept

The card should behave like:

> **Trip first. Route second. Metrics third.**

That is the most important hierarchy rule.

The card should answer, in this order:

1. **What is this trip called?**
2. **Where does it go?**
3. **What kind of journey is it?**
4. **What are the most important practical facts?**

It should not behave like:

1. total distance
2. total time
3. some labels
4. maybe title somewhere above

---

# Card role in the product

## Primary function

The card is the **trip identity anchor**.

## Secondary function

The card is the **compressed high-level summary**.

## Tertiary function

The card is a reusable branded object for:

* results reveal
* viewer entry
* print cover inspiration
* history card evolution
* future sharing surfaces

---

# Required content

The card must include the following content types.

## 1. Trip title

Canonical trip title.

Examples:

* `Lake Superior Escape`
* `Thunder Bay Reset`
* `Your MEE time in Thunder Bay`

This is the hero element.

## 2. Supporting subtitle

A supporting line that preserves MEE framing and dates.

Examples:

* `Your MEE time in Thunder Bay · Sep 12–15`
* `Built by MEE · Sep 12–15`

If title is auto-generated, subtitle may be shorter.
If title is custom, subtitle becomes especially important.

## 3. Route framing

Show route clearly but subordinate to the title.

Examples:

* `Winnipeg → Thunder Bay`
* mini route ribbon / origin-destination line
* route label beneath title/subtitle

This should clarify geography without stealing hero attention.

## 4. Trip Read sentence

One editorial line interpreting the trip.

Examples:

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Smooth shared driving with low stop pressure.`
* `Comfort-first pacing with a clean overnight rhythm.`

This is one of the most important features of the card.

## 5. Core metrics

Only the most essential trip facts:

* total distance
* total drive time
* nights
* rooms
* trip mode

Optional:

* driver count or structure, if compact and helpful

## 6. Route feel / health

A concise high-level interpretation of trip quality.

Examples:

* `Balanced`
* `Comfort-first`
* `Ambitious but workable`
* `Well suited to shared driving`

This should support the trip read, not duplicate it.

---

# Optional content

Include only if the surface and layout support it cleanly.

## Optional items

* mini route ribbon / stylized route path
* overnight anchor summary
* declared-stop highlight
* driver setup summary
* route style badge

These must not crowd the card.

---

# Content hierarchy

## Absolute order of importance

1. Trip title
2. Subtitle
3. Trip Read sentence
4. Route framing
5. Core metrics
6. Route feel / health
7. Optional supporting items

This hierarchy must remain intact across desktop and mobile.

---

# Visual design direction

## Overall tone

The card should feel like:

* premium travel editorial
* warm dark cockpit glass
* elegant roadtrip artifact
* a hero object, not a tool panel

## Visual character

* dark premium base
* warm accent line or glow
* disciplined typography
* soft but confident depth
* breathing room
* subtle route-story cues

## Mood keywords

* composed
* warm
* premium
* roadtrip-romantic
* trusted
* not flashy

---

# Typography spec

## Title

* largest text on the card
* elegant but highly readable
* should feel like the name of the journey

## Subtitle

* lighter and smaller
* support role only
* must not compete with title

## Trip Read sentence

* readable, editorial, medium emphasis
* should feel like interpretation, not metadata

## Metrics

* compact, structured, clean
* can use mono or system-style labels for contrast
* should not become the visual hero

---

# Layout guidance

## Desktop layout

Recommended structure:

### Top section

* title
* subtitle

### Middle section

* trip read sentence
* route framing / route ribbon

### Bottom section

* compact metric row(s)
* health / route feel
* optional supporting badges

This should feel like one composed object, not stacked unrelated blocks.

## Mobile layout

Recommended order:

1. title
2. subtitle
3. trip read
4. route framing
5. metrics
6. route feel

Mobile must preserve hierarchy and avoid stat clutter near the top.

---

# Route framing spec

## Purpose

Help the user orient the trip geographically without stealing the spotlight from the trip identity.

## Acceptable route framing forms

* simple `Origin → Destination`
* mini route ribbon
* subtle path line with endpoints
* minimal route badge

## Rules

* keep route framing elegant and compact
* do not let it dominate visually
* do not turn the card into a map substitute

## Good examples

* `Winnipeg → Thunder Bay`
* a thin route ribbon with two endpoint labels
* a small “Outbound + return” indicator if truly helpful

---

# Trip Read sentence spec

## Purpose

This is the card’s editorial soul.

It answers:

> “What kind of journey is this?”

## Requirements

* one sentence
* concise
* interpretive
* calm
* human-readable
* not too clever

## Good examples

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Comfort-first pacing with one meaningful overnight anchor.`
* `Efficient and rotation-friendly, with low stop pressure.`
* `A longer push, but manageable with shared drivers.`

## Bad examples

* anything that sounds like marketing fluff
* anything that repeats raw numbers only
* anything jokey
* anything too vague like “Looks great”
* anything longer than one compact sentence

## Placement

Directly beneath or near the title block, not buried among metrics.

---

# Core metrics spec

## Purpose

Give practical confidence at a glance without turning the card into a stat sheet.

## Required metric list

* Drive time
* Distance
* Nights
* Rooms
* Mode

Optional:

* drivers

## Metric style

* compact
* evenly structured
* small supporting labels
* should read like “practical facts,” not the headline

## Good metric labels

* `Drive time`
* `Distance`
* `Nights`
* `Rooms`
* `Mode`

## Rules

* do not include too many metrics
* do not put giant numerals above the title
* do not let metrics become the main visual attraction

---

# Route feel / health spec

## Purpose

Provide one short judgment about the trip’s overall practical feel.

## Examples

* `Balanced`
* `Comfort-first`
* `Roadworthy`
* `Smooth shared-driving fit`
* `Ambitious but manageable`

## Rules

* this is a support element
* should not become a warning banner unless truly needed
* should complement the trip read, not duplicate it

---

# Visual composition rules

## Rule 1 — one card, one hero

This is the hero card. It must not be visually tied with three other equal hero cards beside it.

## Rule 2 — title must dominate

If the eye goes to a giant metric before the title, the card has failed.

## Rule 3 — breathing room is part of the premium feel

Do not overpack the card.

## Rule 4 — route cues must support, not compete

No oversized ribbons, no noisy icons, no decorative clutter fighting the title.

## Rule 5 — premium restraint beats feature stuffing

The card should feel intentional and controlled, not overloaded with everything the engine knows.

---

# Surface behavior

## Results reveal

This card should be the primary visual anchor of Layer 1.

## Viewer entry

This card can reappear in a slightly compressed form as the trip’s header identity.

## Print / PDF inspiration

The print cover should visually echo this card’s hierarchy, even if the actual print implementation differs.

## Saved/history surfaces

A lighter-weight descendant of this card may later power richer saved-trip cards.

---

# Canonical truth rules

This card must render from canonical trip truth.

It must not independently invent:

* trip title
* route framing
* trip read meaning if already canonically derived
* metrics from a different truth source
* alternate summary language that conflicts with results/viewer/print

If multiple surfaces use this card or its descendants, they must all derive from the same core summary truth.

---

# Motion guidance

## Purpose

Support elegance, not spectacle.

## Acceptable motion

* card fade/slide into reveal
* route ribbon reveal
* subtle stagger of subtitle / trip read / metrics

## Rules

* motion must not overshadow readability
* motion must not feel flashy
* card should feel like it lands, not pops

---

# Edge cases

## Auto title

If the trip is still using an auto title:

* card still treats it as first-class
* auto title must not feel like a placeholder

## Minimal trips

For simpler trips, card can show lighter lower sections rather than forcing extra detail.

## Heavier trips

For complex trips, card should still stay compact and summary-driven. Do not turn it into a full itinerary panel.

## Route or timing updates

If trip truth updates meaningfully, card should update accordingly and remain consistent everywhere.

---

# Content examples

## Example A — auto title

# `Your MEE time in Thunder Bay`

`Sep 12–15 · Built by MEE`

`A balanced 3-day roadtrip with a deliberate Dryden reset.`

`Winnipeg → Thunder Bay`

Drive time · 16h 41m
Distance · 1401 km
Nights · 2
Rooms · 1
Mode · Auto

Route feel · `Smooth shared driving`

---

## Example B — custom title

# `Lake Superior Escape`

`Your MEE time in Thunder Bay · Sep 12–15`

`Comfort-first pacing with one meaningful reset point.`

`Winnipeg → Thunder Bay`

Drive time · 16h 41m
Distance · 1401 km
Nights · 2
Rooms · 1
Mode · Auto

Route feel · `Balanced`

---

# Guardrails

## Must not do

* become a metric-heavy dashboard tile
* bury the title
* overload with too many badges
* add visual flair that competes with clarity
* fracture into multiple equal-priority cards

## Must do

* make the trip feel named
* make the route feel clear
* make the trip read feel purposeful
* make metrics useful but secondary
* feel premium and screenshot-worthy

---

# Definition of done

This spec is done when:

* the app has one signature trip summary card
* the title is the visual hero
* route framing is clear but secondary
* a trip read sentence exists and enhances the card
* key metrics are present without dominating
* the card feels like a journey cover, not a stat panel
* the card can anchor the results reveal confidently

---

# Kitchen shorthand

## Problem

Trip identity and summary are currently too distributed, which weakens the emotional payoff.

## Goal

Create one premium hero card that acts as the cover page of the journey.

## Outcome

A distinct MEE summary object that is elegant, useful, branded, and emotionally legible at a glance.
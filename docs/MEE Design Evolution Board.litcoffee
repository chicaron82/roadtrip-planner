# MEE Design Evolution Board

## North Star

**MEE should feel like a premium journey composer — not just a planner, but a co-pilot for shaping the road.**

That means every major screen should answer one of these:

* **What kind of trip is this?**
* **What did the engine understand?**
* **What journey did it build?**
* **How does the road now feel in my hands?**

---

# Course 1 — Reframe Step 1 as a Trip Intent Surface

## Current issue

Step 1 still risks feeling like:

* origin field
* destination field
* waypoint management
* date setup
* stop controls

Useful, yes. Memorable, not yet.

## Design goal

Make Step 1 feel like:

> “Tell MEE the shape of the journey.”

## What to change

### Rename the emotional framing

Instead of a generic planning tone, treat the sections more like trip authorship.

Possible section framing:

* **Where the road begins**
* **Where it’s taking you**
* **What happens along the way**
* **When this journey needs to happen**

### Make stop intent feel like route authorship

For stop rows:

* location remains the anchor
* stop intent becomes a polished chip/tag system
* dwell time becomes a natural companion to intent, not an awkward add-on

Visually:

* declared stop roles should feel tactile and intentional
* not checkbox-y in a dead form sense

### Show intent confidence

When user declares something, label it clearly:

* **Declared stop**
* **Engine will infer**
* **Overnight anchor**
* **Quick stop**
* **Fuel + meal reset**

This helps users understand what they are shaping vs what MEE still owns.

## Expected payoff

Step 1 becomes:

* less data entry
* more trip declaration
* more emotionally aligned with the product promise

---

# Course 2 — Make Results Feel Like a Reveal, Not a Return Value

## Current issue

Many trip tools still feel like:

> click button → results appear

That undersells the work your engine is doing.

## Design goal

Make trip completion feel like:

> “MEE read your intent and built a journey.”

## What to change

### Introduce a staged reveal

When the trip finishes:

#### Layer 1 — The headline

* route title
* total distance
* total drive time
* nights / rooms / core budget pulse
* mode badge
* one-line trip read

Example:

> **A smooth 3-day Lake Superior run with a deliberate Dryden reset and balanced shared driving.**

#### Layer 2 — The shape

* canonical timeline preview
* day framing
* trip health
* driver balance
* overnight strategy

#### Layer 3 — The interaction layer

* open viewer
* journal
* enrich with discovery
* print/export

### Add a “Trip Read” sentence

This should become a signature MEE behavior.

Examples:

* “Efficient and rotation-friendly, with one meaningful reset point.”
* “Comfort-first pacing with a clean overnight rhythm.”
* “A long push, but manageable with clear handoff opportunities.”

## Expected payoff

The user feels the trip has been **interpreted**, not just computed.

---

# Course 3 — Create a Signature Premium Trip Summary Card

## Current issue

Stats and results may still feel distributed across surfaces instead of emotionally landing in one place.

## Design goal

Create one **hero object** that feels like the cover page of the journey.

## What it should include

* origin → destination
* route ribbon / mini route visual
* trip read sentence
* total distance / drive time
* nights / room setup
* driver setup
* trip mode
* route feel / health state

### Design tone

Think:

* premium editorial card
* not spreadsheet
* warm dark glass with gold/orange accents
* elegant hierarchy, not busy metrics soup

### Make it screenshot-worthy

This should be the thing someone sees and thinks:

> “Okay damn, this is not a normal planner.”

## Expected payoff

A memorable payoff surface that sells the app’s promise instantly.

---

# Course 4 — Turn the Map into a Story Canvas

## Current issue

The map already helps, but it can still risk being “beautiful background with route.”

## Design goal

The map should feel like:

> “This is the journey unfolding.”

## What to change

### Route reveal moment

When results finish:

* reveal the route with intention
* let the trip arrive visually, not just exist

### Differentiate trip element types visually

Use distinct map language for:

#### Declared stops

* stronger, anchored, confident styling

#### Engine-inferred support stops

* softer system-generated styling

#### Discovered enrichments / POIs

* exploratory / optional styling

#### Overnight anchors

* special visual priority

### Timeline ↔ map linking

When a timeline item is active:

* route segment subtly highlights
* map focus shifts gracefully
* stop card and route feel connected

## Expected payoff

The map becomes part of the emotional story, not just the geography layer.

---

# Course 5 — Build a Stronger “Declared vs Inferred vs Discovered” Design Language

## Current issue

One of MEE’s coolest capabilities is collaborative trip authorship, but that may not yet be visually obvious enough.

## Design goal

Users should immediately understand:

* what **they** declared
* what the **engine** inferred
* what MEE **discovered as enrichment**

## What to change

### Introduce visual categories

#### Declared

* confident tag/chip style
* stronger border or label treatment
* language like: **Declared stop**

#### Inferred

* softer helper tone
* language like: **Engine-estimated**

#### Discovered

* exploratory styling
* language like: **Worth a look** / **Nearby idea**

### Apply this consistently across

* Step 1
* results
* viewer
* map
* print

## Expected payoff

The product feels smarter and more collaborative because its reasoning is legible.

---

# Course 6 — Differentiate Auto vs Manual Mode More Intentionally

## Current issue

They may be functionally different, but should also feel different in personality.

## Design goal

Make the user feel the mode they chose.

## Auto mode should feel like

* confident
* guided
* smooth
* “let MEE cook”

### Design cues

* softer explanatory copy
* cleaner setup burden
* supportive reveal language
* fewer visible heavy controls upfront

## Manual mode should feel like

* authored
* precise
* tuned
* “I’m shaping this trip”

### Design cues

* more explicit control affordances
* slightly more technical microcopy
* stronger sense of custom ownership

## Expected payoff

Mode choice feels meaningful, not just functional.

---

# Course 7 — Give MEE a More Distinct Editorial Voice

## Current issue

MEE has identity, but certain moments could use more confident interpretation.

## Design goal

Let MEE sound like a premium travel editor crossed with a smart roadtrip co-pilot.

## Best places for voice

* results header
* trip health summaries
* overnight recommendations
* route comparison blurbs
* trip read sentence
* viewer hero intro
* print cover

## Tone examples

* “This route works best when Dryden is treated as a proper reset.”
* “A smoother return than the outbound leg, with less stop pressure.”
* “Well suited to shared drivers and comfort-first pacing.”
* “This plan stays efficient without feeling rushed.”

## Expected payoff

The app starts to feel interpretive and premium, not sterile.

---

# Course 8 — Make Print Feel Like a Journey Brief

## Current issue

Print is one of the highest-trust artifacts, but it can still feel too report-like.

## Design goal

Make PDF/export feel like:

> “a premium trip brief you’d actually want to keep.”

## What to change

### Stronger cover hierarchy

* route title
* trip read
* mode
* dates
* rooms / nights / drivers

### Better day separators

Each day should feel like a chapter, not a log dump.

### Labeling clarity

Make declared vs inferred visible in print too.

### Driver handoff clarity

Swap points should read cleanly and humanly.

### Less spreadsheet, more itinerary

Keep utility, but elevate tone and hierarchy.

## Expected payoff

Print becomes a real artifact of the journey, not just output.

---

# Course 9 — Add One Signature Luxury Moment

## Current issue

The app already has flavor. Now it wants one unforgettable payoff.

## Design goal

One moment that says:

> “This is MEE.”

## Candidate luxury moments

### Option A — Route reveal

A really beautiful reveal when the trip resolves.

### Option B — Trip cover card

A gorgeous hero summary with route ribbon and editorial copy.

### Option C — Day divider treatment

Beautiful chapter-like itinerary day breaks.

### Option D — Viewer entry transition

Opening the viewer feels like entering the built journey.

## Recommendation

I’d prioritize **Trip cover card + route reveal**.
That combo gives you the best emotional payoff.

---

# Course 10 — Protect Restraint and Rhythm

## Current issue

You already have enough flavor. The risk now is over-decoration.

## Design goal

Upgrade the app through:

* hierarchy
* pacing
* rhythm
* consistency

Not through “more stuff.”

## Guardrails

* no adding visual flair unless it clarifies or elevates
* one hero per screen
* one accent family doing most of the work
* let breathing room do some of the premium lifting
* make the key moments land harder by calming the surrounding ones

## Expected payoff

The app feels expensive, not busy.

---

# My Top 5 Priority Plays

## 1. Step 1 as Trip Intent

Most important product-design evolution.

## 2. Cinematic Results Reveal

Biggest emotional payoff gain.

## 3. Signature Trip Summary Card

Best premium anchor.

## 4. Declared / Inferred / Discovered visual language

Biggest clarity upgrade.

## 5. Print as Journey Brief

Biggest trust/artifact upgrade.

---

# If I were naming the next design phase

I’d call it:

## **MEE Phase: Journey Authorship**

The shift from:

* planning inputs
  to
* shaping the experience of the road

---

# Kitchen-ready summary

## Main design concern

MEE already has vibe, but it can evolve from “beautiful planner” into “premium journey composer.”

## Design direction

Lean into:

* intent
* reveal
* authorship
* editorial framing
* collaborative engine truth
* premium travel artifact output

## What to avoid

Don’t add more flair just because it looks cool.
Refine hierarchy, rhythm, and payoff instead.

---

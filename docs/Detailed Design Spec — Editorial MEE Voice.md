## Detailed Design Spec — Editorial MEE Voice

## Feature / phase name

**Editorial MEE Voice**

## Purpose

Establish a distinct, premium product voice for MEE that makes the engine feel:

* interpretive
* calm
* intelligent
* road-aware
* premium
* trustworthy

This voice should help the app sound like:

> a journey editor and roadtrip co-pilot

not:

> a sterile trip calculator
> and not:
> a chatty assistant persona

The voice should make the user feel:

* guided without being patronized
* understood without being flattered
* informed without being overwhelmed
* accompanied by a product with taste

---

# Product problem

## Current problem

Without a clearly defined editorial voice, MEE risks sounding like one of two weaker versions of itself:

### Version A — sterile planner

* functional but dry
* technically correct but emotionally flat
* sounds like route software, not an Experience Engine

### Version B — overly chatty helper

* too conversational
* too assistant-like
* too eager or too cute
* weakens the premium tone and product trust

MEE needs a middle path:

* interpretive
* concise
* elegant
* calm
* roadtrip-aware

## Why this matters

Voice is one of the strongest invisible parts of product identity.

For MEE specifically, voice should reinforce:

* the sense that the engine understands the shape of the journey
* the premium positioning
* the collaborative nature of the trip-building process
* the emotional promise of an Experience Engine

If the visual design is premium but the copy sounds generic, a lot of the magic gets lost.

---

# Design goal

## Core goal

Define a product voice that makes MEE feel like a **premium journey editor** rather than a utility tool.

## Experience goal

The user should feel:

* the engine understands the trip
* the product has confidence
* the copy helps them see the journey more clearly
* the tone matches the premium visual identity

## Emotional goal

The voice should feel:

* warm
* composed
* observant
* roadwise
* lightly editorial
* never needy
* never loud

---

# Success criteria

The voice spec is successful when:

* MEE sounds recognizably like itself across surfaces
* trip summaries feel interpreted, not just generated
* health/status messages feel useful without sounding harsh
* route recommendations feel tasteful and clear
* results and print surfaces feel premium and composed
* copy is concise and doesn’t clutter the UI
* no major surface falls into either sterile tool-speak or assistant chatter

---

# Core voice concept

MEE should sound like:

> a calm, capable travel editor with strong roadtrip instincts

It understands:

* pacing
* route feel
* trip pressure
* comfort
* rhythm
* structure
* what makes a journey feel smooth or heavy

It does **not** sound like:

* a cheerleader
* a chatbot
* a salesman
* a debug console
* a productivity app

---

# Voice pillars

## Pillar 1 — Interpretive

MEE should not merely repeat raw data.
It should help the user understand what the trip **means**.

### Good

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `A longer push, but manageable with shared drivers.`
* `Comfort-first pacing with one meaningful overnight anchor.`

### Bad

* `Trip duration is 16h 41m and distance is 1401 km.`
* `Your trip has been successfully calculated.`

The first interprets.
The second only reports.

---

## Pillar 2 — Calm

The voice should feel steady and composed.

### Good

* `Well suited to shared driving.`
* `A smoother return than the outbound leg.`
* `This route works best with one real reset point.`

### Bad

* `Amazing route!`
* `Looks great!`
* `You’re all set!`

Those are too generic and too eager.

---

## Pillar 3 — Premium

The copy should feel carefully chosen, not casual filler.

### Good

* `Built by MEE`
* `Your MEE time in Thunder Bay`
* `A clean overnight rhythm`
* `Low stop pressure`

### Bad

* `Super awesome trip`
* `MEE totally figured it out`
* `Nice!`

Premium means restraint, taste, and control.

---

## Pillar 4 — Road-aware

MEE should sound like it understands travel, not just numbers.

### Good

* `A meaningful reset point`
* `Shared-driver friendly`
* `Comfort-first pacing`
* `Stop pressure stays light`
* `A long push, but roadworthy`

### Bad

* `Node sequence optimized`
* `Calculated segment breakpoints`
* `Engine generated support events`

Those are internal/system views, not product voice.

---

## Pillar 5 — Concise

The best MEE copy should say a lot in very little space.

### Good

* `Balanced`
* `Ambitious but workable`
* `Estimated by MEE`
* `Worth a look`

### Bad

* paragraphs of explanation where a strong sentence would do
* repeated caveats
* too many supporting labels on the same surface

---

# Tone boundaries

## What MEE should sound like

* intelligent
* road-conscious
* editorial
* grounded
* elegant
* quietly confident

## What MEE should not sound like

* flirty
* overly friendly
* jokey
* hype-driven
* apologetic
* robotic
* corporate enterprise mush

---

# Surface-specific voice requirements

## Surface 1 — Step 1

### Purpose of voice here

Make Step 1 feel like trip authorship, not form completion.

### Copy should do

* invite the user to shape the journey
* explain what MEE can infer
* make declared trip truth feel meaningful

### Good examples

* `Give this journey a name, or let MEE title it for you.`
* `Declare key stops, or let the engine infer the rhythm.`
* `Tell MEE what matters along the way.`

### Avoid

* dense instructional copy
* technical validation language
* too much explanation around obvious inputs

---

## Surface 2 — Mode selection

### Purpose of voice here

Make Auto and Manual feel like meaningful travel postures.

### Auto examples

* `Let MEE shape the route`
* `Guide the journey, let MEE handle the rhythm`

### Manual examples

* `Shape the trip directly`
* `Set the route up your way`

### Avoid

* “easy mode”
* “advanced mode”
* techy jargon

---

## Surface 3 — Results reveal

### Purpose of voice here

This is one of the most important editorial surfaces.

MEE should sound like it understood the trip and now has a clear read on it.

### Required voice elements

* trip read sentence
* trip health summary
* route feel
* overnight interpretation if relevant

### Good examples

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Smooth shared driving with low stop pressure.`
* `This route works best with one real overnight reset.`

### Avoid

* `Calculation complete`
* `Trip successfully generated`
* `Results loaded`

---

## Surface 4 — Signature Trip Summary Card

### Purpose of voice here

Provide the trip’s editorial identity at a glance.

### Required voice elements

* title support subtitle
* trip read sentence
* route feel/health wording

### Good examples

* `Your MEE time in Thunder Bay · Sep 12–15`
* `Comfort-first pacing with one meaningful reset point.`
* `Balanced`

### Avoid

* too much copy
* too many labels
* generic filler words

---

## Surface 5 — Viewer

### Purpose of voice here

Support deeper understanding without becoming chatty.

### Voice role

* explain
* contextualize
* help interpret
* keep trust high

### Good examples

* `Declared stop`
* `Estimated by MEE`
* `Suggested by MEE`
* `A smoother return than the outbound leg`

### Avoid

* too much text for every row
* repeating what is visually obvious
* sounding like commentary on every click

---

## Surface 6 — Health / warnings / viability summaries

### Purpose of voice here

Communicate caution or support with confidence and taste.

### Good examples

* `Ambitious but workable`
* `Best treated as a comfort-first route`
* `Low stop pressure`
* `Heavy driving day`
* `Strong shared-driver fit`

### If warning is needed

Keep it honest but composed.

Examples:

* `A long push best split with an overnight anchor.`
* `This route asks a lot from a solo driver.`
* `More comfortable with one additional reset point.`

### Avoid

* alarmist phrasing
* patronizing phrasing
* fake positivity when something is clearly heavy

---

## Surface 7 — Discovery / enrichment

### Purpose of voice here

Make discoveries feel enticing but optional.

### Good examples

* `Worth a look`
* `Nearby discovery`
* `Suggested by MEE`
* `A good detour if you want more from the day`

### Avoid

* sounding like ads
* making optional things sound required
* overhyping every POI

---

## Surface 8 — Print / PDF

### Purpose of voice here

Make the printed artifact feel premium, calm, and worth keeping.

### Good examples

* `Your MEE time in Thunder Bay`
* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Declared stop`
* `Driver handoff`
* `Engine-estimated fuel support`

### Tone rule

Print voice should feel slightly more formal and polished than live UI voice, but still recognizably MEE.

### Avoid

* dry report-speak
* cluttered labels
* casual UI shorthand that feels too app-like on paper

---

# Voice types by content function

## Type 1 — Interpretive sentence

Purpose: help the user understand the trip.

Examples:

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Comfort-first pacing with low stop pressure.`

Use in:

* results
* summary card
* print cover
* route comparisons

---

## Type 2 — Status phrase

Purpose: quickly describe viability or feel.

Examples:

* `Balanced`
* `Comfort-first`
* `Ambitious but workable`
* `Shared-driver friendly`

Use in:

* summary card
* health blocks
* route comparison chips

---

## Type 3 — Source label

Purpose: explain where a piece of truth came from.

Examples:

* `Declared`
* `Estimated by MEE`
* `Suggested by MEE`
* `Custom title`

Use in:

* viewer
* Step 1
* print
* discovery surfaces

---

## Type 4 — Guidance line

Purpose: lightly steer the user without overwhelming them.

Examples:

* `Declare key stops, or let MEE infer the rhythm.`
* `Give this journey a name, or let MEE title it for you.`

Use in:

* Step 1
* input surfaces
* setup guidance

---

# Writing rules

## Rule 1 — Prefer interpretation over repetition

Do not just echo raw numbers if a phrase can explain what they imply.

## Rule 2 — Prefer short, strong copy

If a sentence can be cut in half and remain meaningful, cut it.

## Rule 3 — Prefer road language over systems language

Say:

* `reset point`
  instead of
* `segment recovery marker`

## Rule 4 — Prefer calm confidence over enthusiasm

Say:

* `Well suited to shared driving`
  instead of
* `This is awesome for groups!`

## Rule 5 — Prefer product voice over assistant voice

This is app copy, not a chat persona.

---

# Approved vocabulary direction

## Good vocabulary

* journey
* road
* route
* pacing
* rhythm
* reset
* anchor
* shared driving
* stop pressure
* comfort-first
* balanced
* smooth
* worthwhile
* declared
* estimated
* suggested

## Vocabulary to limit or avoid

* amazing
* awesome
* perfect
* successful
* generated
* processed
* optimized
* derived
* compute/compiled-style language
* too much “trip” repetition in every sentence

---

# Sentence style rules

## Good sentence shape

* one sentence
* one idea
* strong noun + strong adjective + road-aware interpretation

### Examples

* `A smoother return than the outbound leg.`
* `A long push, but manageable with shared drivers.`
* `This route works best with a true Dryden reset.`

## Avoid

* multiple clauses stacked together
* overly verbose explanations
* abstract phrases with no travel meaning
* exclamation points unless there is a truly special reason, which should be rare

---

# Brand relationship

## Rule

MEE branding should feel like a signature, not a slogan shouted everywhere.

### Good

* `Built by MEE`
* `Your MEE time in Thunder Bay`
* `Suggested by MEE`

### Avoid

* forcing “MEE” into every line
* sounding self-congratulatory
* branding at the expense of elegance

---

# Accessibility / clarity rules

## Purpose

Voice must remain readable and clear under real UI constraints.

## Requirements

* no overly poetic copy that becomes vague
* labels must remain understandable at a glance
* supporting text must not become walls of prose
* the most important information must still scan quickly

## Guardrails

* premium does not mean ornate
* editorial does not mean vague

---

# Edge cases

## Bad/strained trips

When the trip has problems, voice must remain honest.

### Good

* `A long push best broken with an overnight reset.`
* `This route is viable, but asks a lot from one driver.`

### Avoid

* pretending everything is fine
* harsh scolding language
* panic tone

---

## Very simple trips

Even simple trips deserve composed language.

### Good

* `A straightforward run with light stop pressure.`

### Avoid

* over-writing simple cases with unnecessary editorial flourish

---

## Discovery-heavy trips

Keep optionality clear.

### Good

* `Worth a look`
* `A scenic detour if you want more from the day`

### Avoid

* making every suggestion sound essential

---

# Canonical truth rules

Editorial voice may interpret trip truth, but it must not contradict canonical truth.

It must not:

* invent facts
* overstate confidence
* call something declared when it was inferred
* imply support that the engine did not actually generate

Voice is a framing layer, not a truth-replacement layer.

---

# Guardrails

## Must not do

* sound like assistant chat
* sound like sterile software
* over-explain
* overhype
* use inconsistent category language
* turn product copy into flavor text everywhere

## Must do

* sound calm and road-aware
* help users understand trip meaning
* stay concise
* reinforce premium tone
* remain consistent across key surfaces

---

# Definition of done

This spec is done when:

* MEE sounds recognizably like itself across major surfaces
* results and summaries feel interpreted, not merely reported
* setup copy supports authorship
* warnings remain calm and useful
* discovery feels optional and tasteful
* print voice feels premium and composed
* the app no longer swings between sterile tool-speak and assistant chatter

---

# Kitchen shorthand

## Problem

MEE’s visual design is developing a premium identity, but without a clearly defined editorial voice, the product can still sound too generic, too technical, or too chatty.

## Goal

Create a calm, road-aware, premium product voice that helps MEE feel like a journey editor and co-pilot.

## Outcome

A more distinctive, trustworthy, and emotionally aligned product where the copy reinforces the Experience Engine promise.
## Detailed Design Spec — Restraint, Rhythm, and Premium Control

## Feature / phase name

**Restraint, Rhythm, and Premium Control**

## Purpose

Define the design rules that keep MEE feeling:

* premium
* composed
* intentional
* spacious
* trustworthy

as it grows in capability.

This spec is not about adding a new feature.
It is about protecting the product from becoming:

* cluttered
* over-decorated
* too loud
* too dense
* visually self-indulgent
* emotionally inconsistent

This is the spec that keeps MEE from turning into:

> “a lot of cool ideas on the same screen”

and ensures it remains:

> “a product with taste, hierarchy, and confidence.”

---

# Product problem

## Current problem

MEE already has:

* a strong visual identity
* layered product thinking
* premium mood
* warm/glass/editorial aesthetics
* lots of opportunities for beautiful touches

That is a strength.

It is also a risk.

As products get richer, they often start accumulating:

* too many accents
* too many badges
* too many visual categories shouting at once
* too many “special” moments
* too much UI density
* too much eagerness to explain everything

That can slowly erode premium quality.

Premium design is not built only by what gets added.
It is protected by what gets **held back**.

## Why this matters

MEE is aiming to be an **Experience Engine**, not a normal planner.
That means the experience has to feel:

* authored
* elevated
* controlled
* road-aware
* confident

If every screen tries to prove how clever it is all at once, the product loses:

* clarity
* rhythm
* emotional impact
* user trust
* elegance

This spec exists to make sure MEE’s design remains **disciplined enough to feel expensive**.

---

# Design goal

## Core goal

Create a design operating system that protects MEE’s premium feel through:

* hierarchy
* rhythm
* spacing
* control
* restraint

## Experience goal

The user should feel:

* guided, not crowded
* impressed, not overwhelmed
* supported, not managed
* that the product knows what matters most on each screen

## Emotional goal

The product should feel:

* calm
* deliberate
* expensive
* clear
* roadworthy
* elegant

It should not feel:

* busy
* noisy
* self-conscious
* over-styled
* overly eager to entertain

---

# Success criteria

This spec is successful when:

* each screen has one obvious focal point
* the user can scan the interface without visual fatigue
* decorative and emotional design elements support the product instead of competing with it
* important actions are clear without button overload
* the app feels premium because of control, not because of constant flourish
* new features do not automatically add more visual noise
* the product retains identity without becoming indulgent

---

# Core UX concept

Premium design is often the result of **careful omission**.

This means MEE should operate by a few core truths:

### 1. Not everything important should look equally important

Hierarchy matters.

### 2. Not every feature needs a visual spotlight

Focus matters.

### 3. Not every screen needs a signature flourish

Rhythm matters.

### 4. Emotional payoff lands harder when the surrounding experience is calm

Restraint matters.

This spec is the control layer for all other design specs.

---

# Core principles

## Principle 1 — One hero per screen

Every major screen should have one dominant visual or conceptual focal point.

Examples:

* Step 1 → journey intent surface
* Results → trip reveal hero
* Viewer → active trip structure
* Print → trip brief cover hierarchy

### Rule

No screen should feel like it has three competing “main things.”

---

## Principle 2 — Information should arrive in layers

Do not present all meaning at once.

MEE should reveal information with pacing:

* identity first
* shape second
* controls third
* supporting details last

### Rule

If a screen feels like a wall of equally weighted information, it needs hierarchy work.

---

## Principle 3 — Visual richness must serve comprehension

Every premium touch should either:

* clarify
* orient
* elevate
* reinforce identity

If it does none of those, it is probably noise.

### Rule

No visual effect earns its place just by looking cool.

---

## Principle 4 — Calm surfaces create stronger moments

Luxury moments only feel luxurious if the rest of the product is composed.

### Rule

Do not try to make every surface feel like the hero moment.

---

## Principle 5 — Breathing room is part of the design system

Spacing is not leftover emptiness.
It is part of the product’s premium tone.

### Rule

If everything fits but nothing breathes, the screen is not done.

---

# Rhythm spec

## Purpose

Rhythm is how the product moves the eye, the mind, and the user’s attention.

MEE should have good rhythm across:

* vertical spacing
* content density
* reveal pacing
* interaction flow
* emotional beats

## Desired rhythm

* calm entry
* clear focus
* layered understanding
* obvious next action
* graceful transitions between dense and light surfaces

## Bad rhythm examples

* giant form wall followed by giant result wall
* multiple competing cards all claiming importance
* too many badges or sublabels stacked at once
* every section trying to be beautiful in the same loud way

## Good rhythm examples

* clear hero block
* one supporting layer
* one next-step layer
* practical details below
* visual breathing room between conceptual chunks

---

# Hierarchy spec

## Purpose

Make sure the user always knows what matters most.

## Hierarchy order should generally be

1. what this screen is about
2. what matters most on this screen
3. what the user should understand next
4. what the user can do next
5. what supporting information exists beneath that

## Rule

If the first glance does not tell the user where to look, the hierarchy is failing.

## Good hierarchy signals

* scale
* spacing
* contrast
* position
* grouping
* subdued supporting text

## Bad hierarchy signals

* using color everywhere
* making every card high-contrast
* relying on badges for all meaning
* too many equal-weight sections

---

# Density control spec

## Purpose

Keep the product rich but breathable.

## Density rules by surface

### Hero surfaces

Examples:

* results reveal
* signature trip summary card
* print cover

These should be:

* spacious
* focused
* not overloaded
* title-led

### Operational surfaces

Examples:

* viewer
* itinerary detail
* Step 1 stop editing
* discovery panel

These can hold more information, but must still:

* use grouping
* respect rhythm
* avoid control pileups

### Supporting surfaces

Examples:

* saved trips
* side summaries
* helper blocks

These should be:

* concise
* secondary
* not trying to become hero objects

## Rule

Richer data does not justify denser layout by default.

---

# Accent control spec

## Purpose

Prevent the product from overusing visual emphasis.

## Accent system role

Accents should:

* support category meaning
* support brand warmth
* support selected/focused state
* support premium identity

They should not:

* become the main source of hierarchy everywhere
* appear on every object
* create visual competition

## Rules

* one primary accent family should do most of the work
* supporting accent systems should be rare and intentional
* optional/discovery accents must not overpower the route
* highlighted states should remain special, not default

## Bad accent use

* too many colored chips in every row
* strong accent glows on all major cards
* discovery markers brighter than canonical route anchors

## Good accent use

* title area gets quiet support
* selected/focused state gets meaningful contrast
* declared/inferred/discovered distinctions are visible but restrained

---

# Motion restraint spec

## Purpose

Keep motion premium instead of gimmicky.

## Motion should do

* clarify reveal order
* support focus shifts
* make transitions feel expensive
* help the trip “arrive”

## Motion should not do

* constantly perform
* bounce for personality
* exaggerate every state change
* turn every interaction into a scene

## Rules

* use motion most strongly on major moments only
* micro-interactions should be subtle
* reduced-motion paths must still feel elegant
* no motion should exist only to show off animation skill

## Premium motion feel

* weighted
* calm
* crisp
* restrained
* deliberate

---

# Card system restraint spec

## Purpose

Prevent card overload and preserve hierarchy.

## Rule 1 — Not everything gets a hero card

Some information belongs in supporting rows, compact blocks, or quiet sections.

## Rule 2 — Card treatment should reflect importance

* hero cards = strongest treatment
* operational cards = practical treatment
* support cards = quieter treatment

## Rule 3 — Avoid too many competing card styles

The product should not feel like:

* every section invented its own premium language

## Desired result

Cards feel like part of one ecosystem with different levels of importance, not a collection of unrelated component showcases.

---

# Badge and label restraint spec

## Purpose

Prevent “badge soup.”

## Problem

As products mature, labels pile up:

* status
* type
* source
* mode
* warning
* confidence
* optionality

Too many labels make the UI feel noisy and insecure.

## Rules

* only show a badge if it adds real comprehension
* prefer one meaningful label over multiple stacked labels
* hero surfaces should use badges lightly
* operational surfaces may use more labels, but still selectively

## Good use

* `Declared`
* `Estimated by MEE`
* `Suggested by MEE`
* `Custom title`

## Bad use

* one row with 4+ chips all fighting for attention
* badges repeating what is obvious from layout or content

---

# Copy restraint spec

## Purpose

Keep editorial voice premium instead of verbose.

## Rules

* prefer one strong sentence over three explanatory ones
* avoid repeating what is visually obvious
* do not over-narrate every part of the app
* let headings, spacing, and labels do some of the work

## Good example

`A smoother return than the outbound leg.`

## Bad example

`This return route is expected to feel smoother than the outbound leg because it includes fewer stops and more balanced pacing across the day.`

The first feels premium.
The second feels like over-explanation.

---

# Surface-specific restraint guidance

## Step 1

### Risk

Becoming a dense “smart planner” form wall.

### Control rule

* preserve space
* keep one clear section focus at a time
* do not let stop intent controls create visual clutter

---

## Results reveal

### Risk

Turning into too many summary cards and too many CTA blocks at once.

### Control rule

* trip identity first
* trip shape second
* actions third
* keep the reveal hero clean

---

## Summary card

### Risk

Becoming a dashboard tile with title attached.

### Control rule

* title must dominate
* route + read + metrics must support it
* avoid stat overload

---

## Viewer

### Risk

Too many categories, badges, and support labels at once.

### Control rule

* operational clarity first
* category language where needed, not everywhere
* selected context should simplify, not complicate

---

## Map

### Risk

Too many marker types and accents fighting for attention.

### Control rule

* route spine first
* declared/inferred/discovered distinction second
* active focus third
* optional discovery never overwhelms the trip

---

## Print

### Risk

Overdesigning the artifact into something beautiful but less usable.

### Control rule

* chapter clarity first
* premium structure second
* decoration must never reduce scanability

---

# Signature moment protection spec

## Purpose

Preserve the luxury moment by keeping it rare and meaningful.

## Rule

The signature luxury moment should remain mostly tied to:

* successful trip reveal

## Do not

* replay full dramatic reveal everywhere
* make every transition feel “special”
* dilute the signature moment by overusing it

## Why

Premium moments feel premium because they are earned and scoped.

---

# “Does it earn its place?” review test

Any new visual/design addition should pass all of these questions:

## 1. Does it clarify something?

If no, it’s suspect.

## 2. Does it elevate a meaningful moment?

If no, it may be decoration.

## 3. Does it preserve hierarchy?

If no, it probably harms the product.

## 4. Does it fit the existing MEE language?

If no, it risks fragmentation.

## 5. Would the screen be better without it?

If yes, cut or redesign it.

This should be a standing design review filter for the kitchen.

---

# Accessibility / legibility rules

## Purpose

Make sure “premium” never means less usable.

## Rules

* hierarchy must survive without rich color
* spacing must support scanability
* typography must remain readable
* active/focused states must be obvious
* density must not reduce real-world usability

## Guardrail

If something looks elegant but slows down understanding, it is not premium enough yet.

---

# Edge cases

## High-feature screens

When many features converge on one screen:

* prioritize hierarchy aggressively
* hide less important information
* do not visually equalize all controls

## New future features

When new functionality is added:

* it does not automatically get a new visual treatment
* it must integrate into the established rhythm

## Discovery-rich experiences

Optional discovery should remain delightful but not visually flood the experience.

## Power-user flows

More advanced control does not justify abandoning calm structure.

---

# Canonical truth relationship

This spec is presentation discipline, not truth logic.

But it must support canonical truth by ensuring:

* visuals do not imply false importance
* optional things do not masquerade as core truth
* hero elements reflect actual canonical trip state
* categories remain honest and legible

---

# Guardrails

## Must not do

* make every screen feel equally dramatic
* add flourishes that do not clarify or elevate
* stack too many card styles, chip styles, or accents
* flatten all information into the same visual weight
* confuse premium with over-designed
* sacrifice usability for mood

## Must do

* protect hierarchy
* protect rhythm
* protect breathing room
* let important moments stand out because surrounding surfaces stay calm
* make MEE feel composed and expensive through control

---

# Definition of done

This spec is done when:

* each major screen has one clear focal point
* the product feels layered rather than cluttered
* new features integrate without visual chaos
* badges, accents, and card styles remain controlled
* the app’s premium tone comes from discipline, not just polish
* the signature luxury moment still feels special because the rest of the product stays calm

---

# Kitchen shorthand

## Problem

As MEE gets richer, it risks becoming too busy, too decorative, or too eager to show everything at once.

## Goal

Protect the product’s premium feel through hierarchy, pacing, spacing, and disciplined restraint.

## Outcome

A calmer, clearer, more expensive-feeling MEE where emotional payoff lands harder because the design stays controlled.
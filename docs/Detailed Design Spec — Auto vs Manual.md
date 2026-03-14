## Detailed Design Spec — Auto vs Manual Mode Mood Separation

## Feature / phase name

**Auto vs Manual Mode Mood Separation**

## Purpose

Differentiate **Auto** and **Manual** planning modes not only by capability, but by **emotional posture, pacing, and design language**.

The goal is not to make them feel like two different products.
The goal is to make them feel like two different **ways of traveling with MEE**.

Users should feel:

* **Auto mode:** “MEE’s got this. I’ll guide the vibe.”
* **Manual mode:** “I’m shaping this trip directly.”

This distinction should be visible through:

* copy
* layout emphasis
* control density
* reveal pacing
* supporting UI language
* action framing

Not through a total redesign.

---

# Product problem

## Current problem

Auto and Manual mode can be functionally different while still feeling emotionally too similar.

That creates a flat planning experience where:

* mode choice feels technical rather than meaningful
* Auto doesn’t feel guided enough
* Manual doesn’t feel authored enough
* users may not understand why they’d choose one over the other

In an Experience Engine, mode choice should feel like choosing **how to collaborate with the road**.

## Why this matters

Mode is one of the most important framing decisions in the app.

If MEE wants to feel premium and intentional, then:

* Auto mode should feel confident, calm, and intelligently supportive
* Manual mode should feel deliberate, tuned, and user-shaped

Without that distinction, the product loses:

* emotional clarity
* planning identity
* user trust in the engine’s role
* a major opportunity for product character

---

# Design goal

## Core goal

Make Auto and Manual feel like two distinct planning attitudes inside one coherent MEE design system.

## Experience goal

The user should understand, without reading a long explanation:

* Auto = guided, low-friction, MEE-led
* Manual = authored, detailed, user-led

## Emotional goal

### Auto mode should feel

* smooth
* confident
* supported
* calm
* low-friction
* “let the engine cook”

### Manual mode should feel

* precise
* deliberate
* authored
* powerful
* slightly more hands-on
* “I’m shaping this route myself”

---

# Success criteria

This feature is successful when:

* users can feel the difference between modes immediately
* Auto mode feels easier and less control-heavy
* Manual mode feels more intentional and craft-oriented
* the app remains visually coherent across both modes
* mode-specific differences enhance identity without fragmenting the product
* mode choice feels meaningful, not just technical

---

# Core UX concept

Mode is not just a setting.
Mode is a **relationship model** between the user and MEE.

## Auto mode relationship

MEE leads, user guides.

The user says:

* where they’re going
* what kind of trip they want
* what matters

MEE responds by:

* shaping the journey
* inferring the rhythm
* smoothing the route

## Manual mode relationship

User leads, MEE supports.

The user says:

* the route shape
* the stop structure
* the journey rhythm
* the explicit decisions

MEE responds by:

* supporting
* validating
* enriching
* tightening

That relational difference should be visible in the experience.

---

# Product principles

## Principle 1 — One product, two moods

Auto and Manual should feel like siblings, not strangers.

## Principle 2 — Mood comes from pacing, tone, and density

Do not fork the whole UI.
Differentiate through emphasis and flow.

## Principle 3 — Auto reduces visible burden

Auto should feel easier without feeling simplistic.

## Principle 4 — Manual increases authorship

Manual should feel more deliberate without feeling punishing.

## Principle 5 — Neither mode should feel “less premium”

Auto is not beginner mode.
Manual is not debug mode.

---

# Mode identity system

## Auto mode identity

### Planning posture

Guided and confident.

### User feeling target

> “I’m telling MEE what kind of journey I want, and it’s helping build it.”

### Product role

MEE is the co-pilot with stronger initiative.

### Key signals

* less visible control burden
* more confidence language
* more supportive copy
* smoother reveal pacing
* more emphasis on interpretation

---

## Manual mode identity

### Planning posture

Direct and authored.

### User feeling target

> “I’m shaping this journey intentionally, and MEE is helping me make it work.”

### Product role

MEE is the toolsmith and route assistant.

### Key signals

* more visible control affordances
* more explicit route-shaping emphasis
* more direct labels
* more detail-forward interaction
* stronger feeling of user ownership

---

# Entry / mode selection behavior

## Purpose

The moment a user chooses a mode should feel meaningful and clear.

## Requirement

Mode selection UI should communicate both:

* what the mode does
* how the mode feels

## Auto mode selection copy direction

Examples:

* `Let MEE shape the route`
* `Guide the journey, let MEE handle the rhythm`
* `Best when you want a strong starting plan fast`

## Manual mode selection copy direction

Examples:

* `Shape the trip directly`
* `Choose the stops, structure, and pacing yourself`
* `Best when you already know how the road should unfold`

## Visual emphasis

* Auto card should feel smoother, softer, more guided
* Manual card should feel a bit more structured and deliberate

## Guardrails

* do not position Auto as “basic”
* do not position Manual as “expert-only”
* both should feel capable and premium

---

# Step 1 behavior by mode

## Auto mode Step 1

### Purpose

Capture the core trip truth with minimal visible burden.

### Behavior

* preserve the journey-intent framing
* emphasize destination, trip identity, and key declared stops
* downplay unnecessary control complexity up front
* let the user leave more things untyped if they want MEE to infer them

### Design feel

* cleaner
* more spacious
* fewer heavy cues
* more supportive helper copy

### Copy direction

Examples:

* `Tell MEE the key points, and it will shape the rest.`
* `Add important stops, or let the engine infer the rhythm.`

### Control density

* fewer strong prompts to fine-tune every field
* default values and inference should feel embraced, not apologetic

---

## Manual mode Step 1

### Purpose

Make authorship feel deliberate and respected.

### Behavior

* preserve trip intent framing, but allow more explicit shaping cues
* make stop meaning, route structure, and timing feel more directly user-authored
* allow controls to feel more intentionally configurable

### Design feel

* more structured
* more direct
* slightly more technical confidence
* still premium, but more “craft” than “glide”

### Copy direction

Examples:

* `Shape the journey the way you want it to unfold.`
* `Set the key stops, structure, and pacing directly.`

### Control density

* more explicit control visibility is okay here
* user should feel allowed to care about details

---

# Content / copy separation

## Auto mode tone

### Should sound like

* confident
* supportive
* smooth
* calm
* interpretive

### Good examples

* `MEE will infer the route rhythm from what matters most.`
* `A strong starting plan, shaped around your intent.`
* `You set the direction. MEE handles the pacing.`

### Avoid

* copy that sounds overly technical
* copy that demands too much precision too early
* anything that makes Auto feel like a lesser mode

---

## Manual mode tone

### Should sound like

* precise
* respectful
* deliberate
* authored
* clear

### Good examples

* `Choose the route structure that fits your trip.`
* `Set the key stops and let MEE support the details.`
* `A more hands-on way to shape the road.`

### Avoid

* copy that sounds dry or enterprise-y
* copy that suggests Manual is tedious admin work
* copy that over-explains obvious controls

---

# Visual treatment differences

These differences must be **real but restrained**.

## Auto mode visual cues

### Should feel

* guided
* airy
* confident
* less tool-heavy

### Recommended treatment direction

* a little more breathing room
* a little less visual density
* more emphasis on journey framing and intent
* stronger reliance on supportive helper text rather than hard-edged control emphasis
* more fluid section transitions

### Suggested signals

* softer sublabels
* slightly calmer support copy
* fewer high-contrast “advanced” looking elements

---

## Manual mode visual cues

### Should feel

* direct
* deliberate
* more route-craft oriented

### Recommended treatment direction

* controls can be a bit more visually present
* route-shaping interactions can feel slightly more explicit
* layout can communicate “structured authorship”
* clearer distinction between required and optional control areas

### Suggested signals

* slightly stronger control framing
* a bit more compact information grouping where useful
* more explicit affordance language

---

# Results reveal behavior by mode

## Auto mode results reveal

### Goal

Make the user feel:

> “MEE understood my intent and built a strong trip.”

### Emphasis

* trip read sentence
* trip feel
* interpretation
* confidence
* route smoothness

### Copy examples

* `A smooth shared-driver run with clear support from MEE.`
* `A balanced route shaped around your declared anchors.`

### Reveal pacing

* slightly more cinematic
* more emphasis on “here’s what MEE built for you”

---

## Manual mode results reveal

### Goal

Make the user feel:

> “MEE respected the structure I chose and helped make it coherent.”

### Emphasis

* route authorship
* user-shaped structure
* engine support where relevant
* validation of user choices

### Copy examples

* `Your route shape holds together cleanly with strong support stops.`
* `A user-shaped trip with efficient pacing and low stop pressure.`

### Reveal pacing

* still premium and layered
* slightly more emphasis on “your trip, sharpened by MEE”

---

# Viewer behavior by mode

## Auto mode viewer

### Feel

* interpretive
* guided
* “here’s the trip MEE built”
* system-confidence-forward

### Emphasis

* trip understanding
* why the route works
* what MEE inferred
* what can be tuned if desired

---

## Manual mode viewer

### Feel

* more authored
* more structurally owned by the user
* “this is the trip you shaped”

### Emphasis

* user-defined route structure
* declared stop meaning
* how MEE supported rather than led

---

# Suggested mode-specific UI signals

These should be subtle, not theatrical.

## Auto mode signals

* helper text leans supportive
* category labels can emphasize engine support gracefully
* CTAs lean toward viewing and trusting the plan

### Example CTA style

* `See the trip MEE built`
* `Open Trip Viewer`

## Manual mode signals

* helper text leans authorship-forward
* declared structure gets more visible recognition
* CTAs can reinforce shaping/ownership

### Example CTA style

* `Review your route`
* `Open Trip Viewer`
* `Refine the journey`

---

# Category language interaction with mode

The declared/inferred/discovered language system must still work in both modes.

## In Auto mode

* inferred elements may be more common
* this should feel natural, not like the engine overrode the user

## In Manual mode

* declared elements should feel more prominent and more expected
* inferred support should feel respectful and secondary

## Rule

The category system remains consistent.
Mode changes **tone and emphasis**, not the underlying category definitions.

---

# Print / export behavior by mode

## Purpose

Print should carry some trace of mode identity without becoming visually split into two separate templates.

## Auto mode print feel

* more “journey brief shaped by MEE”
* slightly more engine-editorial framing

## Manual mode print feel

* more “crafted route brief”
* slightly stronger sense of user authorship

## Rule

Print hierarchy stays the same.
Differences should come from:

* title/subtitle framing
* trip read tone
* supporting descriptors

Not from radically different layouts.

---

# Interaction density rules

## Auto mode

Should default toward:

* lower visible complexity
* softer burden
* smoother path to output

## Manual mode

Can support:

* slightly more visible shaping controls
* more direct route-editing emphasis
* stronger sense of deliberate control

## Important guardrail

Do not punish users for choosing Manual by making it feel cluttered or exhausting.

---

# Motion and pacing rules

## Auto mode

Motion can feel a touch more cinematic and “engine reveal” oriented.

## Manual mode

Motion can feel a touch more controlled and authored.

## Important rule

This should be subtle.
No heavy “theme swap” behavior.

---

# Accessibility / clarity rules

## Requirements

* differences between Auto and Manual must not rely on color alone
* tone/copy/layout density should do meaningful work
* the product should remain coherent for all users regardless of mode

## Guardrails

* no essential functionality hidden behind mood cues
* mood separation must not reduce clarity

---

# Edge cases

## User switches mode mid-flow

The UI should update its framing and emphasis, but not make the user feel like they entered a different app.

## Trip is mostly user-declared even in Auto

Still let Auto feel guided, but reflect the strong authored input respectfully.

## Trip is mostly engine-shaped even in Manual

Still let Manual feel user-led, but don’t pretend the user declared more than they did.

## Minimal/simple trips

Mode mood should remain visible through tone and structure, even when the trip is simple.

---

# Canonical truth rules

Mode influences:

* framing
* tone
* emphasis
* reveal style

Mode must not cause surfaces to fabricate different trip truth.

The actual trip remains canonical.
Mode affects **how MEE presents the collaboration**, not what the trip secretly is.

---

# Guardrails

## Must not do

* make Auto feel like “easy mode”
* make Manual feel like “expert/debug mode”
* fork the visual system into two separate products
* use mode differences as an excuse for inconsistency
* overwhelm Manual with too much density
* flatten Auto into oversimplified blandness

## Must do

* make mode choice emotionally legible
* preserve premium tone in both
* differentiate via pacing, copy, and emphasis
* keep one coherent MEE identity across modes

---

# Definition of done

This spec is done when:

* Auto and Manual feel meaningfully different in mood
* mode choice feels like choosing a planning posture, not a technical toggle
* Auto feels guided and MEE-led
* Manual feels authored and user-led
* both modes remain premium, clear, and coherent
* the differences show up through tone, density, and pacing rather than a complete visual fork

---

# Kitchen shorthand

## Problem

Auto and Manual currently risk feeling functionally different but emotionally too similar.

## Goal

Create a clear mood separation so mode choice feels meaningful and aligned with how the user wants to travel with MEE.

## Outcome

A stronger product identity where Auto feels guided, Manual feels authored, and both remain unmistakably MEE
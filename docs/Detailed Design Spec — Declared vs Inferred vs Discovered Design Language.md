## Detailed Design Spec — Declared vs Inferred vs Discovered Design Language

## Feature / phase name

**Declared vs Inferred vs Discovered Design Language**

## Purpose

Create a consistent, product-wide visual and language system that clearly distinguishes between:

* **Declared** — things the user explicitly told MEE
* **Inferred** — things MEE estimated or inserted to make the trip work
* **Discovered** — optional enrichments, suggestions, or nearby ideas surfaced by MEE

This system should make MEE’s intelligence **legible**.

The user should be able to tell, at a glance:

> “This part is mine. This part is the engine helping. This part is optional exploration.”

That distinction is one of MEE’s biggest product advantages, and it should be visible across the app.

---

# Product problem

## Current problem

Without a clear design language, trips can feel flattened into one undifferentiated output.

That creates several trust problems:

* user-declared stops do not feel more authoritative than engine-estimated ones
* MEE-added support stops can look like user intent
* optional discovery can look like required itinerary structure
* the user may not understand how much of the trip they authored vs how much MEE shaped

This weakens one of MEE’s best qualities:
**collaborative trip authorship**.

## Why this matters

MEE is not just generating routes. It is participating in the construction of a journey.

That means the product has three important kinds of truth:

1. what the user explicitly shaped
2. what the engine inferred for viability or smoothness
3. what MEE found as optional enrichment

If these feel visually identical, the user loses:

* clarity
* trust
* authorship
* appreciation for the engine’s contribution

---

# Design goal

## Core goal

Make the distinction between **declared**, **inferred**, and **discovered** clear and consistent across all major surfaces.

## Experience goal

The user should feel:

* “I can see what I decided”
* “I can see where MEE helped”
* “I can see what is optional”

## Emotional goal

This system should make the app feel:

* more intelligent
* more collaborative
* more transparent
* more premium
* more trustworthy

It should not feel:

* over-labeled
* technical
* busy
* like a debugging overlay

---

# Success criteria

This design language is successful when:

* users can correctly identify authored vs inferred vs optional trip elements
* declared items feel stronger and more authoritative
* inferred items feel helpful but secondary
* discovered items feel inviting but optional
* the same category wording and styling appears consistently across surfaces
* the visual system improves trust without cluttering the UI
* the design feels like a product language, not a legend pasted on top

---

# Core UX concept

MEE should present trip structure as a collaboration between:

* **you**
* **the engine**
* **the road itself**

That collaboration should be visible.

The design language should answer three questions:

### 1. What did I explicitly tell MEE?

That is **Declared**.

### 2. What did MEE infer to make this journey work?

That is **Inferred**.

### 3. What did MEE surface as something I *could* add or care about?

That is **Discovered**.

This is not just a badge system.
It is a product-wide clarity system.

---

# Category definitions

## Category 1 — Declared

### Meaning

Something the user explicitly defined.

Examples:

* manually added key stops
* stop role selections like fuel / meal / overnight
* trip title custom edits
* explicit overnight anchors
* user-defined route structure or planning intent

### Product role

Declared elements represent **user authorship**.

### Design intent

Declared elements must feel:

* grounded
* intentional
* trusted
* primary

### User interpretation target

> “I chose this.”

---

## Category 2 — Inferred

### Meaning

Something MEE added, estimated, or interpreted in order to make the trip viable, coherent, or comfortable.

Examples:

* engine-estimated fuel stops
* engine-estimated meal timing
* support stops added for route viability
* trip health interpretation
* route rhythm estimates
* certain overnight or pacing assumptions where user did not explicitly declare them

### Product role

Inferred elements represent **engine intelligence**.

### Design intent

Inferred elements must feel:

* helpful
* trustworthy
* clearly system-originated
* less authoritative than declared truth

### User interpretation target

> “MEE figured this out for me.”

---

## Category 3 — Discovered

### Meaning

Something MEE found as optional enrichment or exploration.

Examples:

* nearby POIs
* scenic stops
* attraction suggestions
* optional detours
* worthy-of-a-look additions

### Product role

Discovered elements represent **optional curiosity and enrichment**.

### Design intent

Discovered elements must feel:

* optional
* inviting
* exploratory
* clearly not part of the canonical trip unless accepted

### User interpretation target

> “MEE found this for me to consider.”

---

# Product-wide principles

## Principle 1 — Declared outranks inferred

Anything the user explicitly declared must feel more authoritative than something the engine inferred.

## Principle 2 — Inferred outranks discovered in trip structure

If something is part of the actual built trip, even as engine-estimated support, it should feel more structurally important than optional discoveries.

## Principle 3 — Discovered must remain optional-feeling

Discoveries can be tempting, beautiful, and useful — but they must not visually masquerade as canonical trip truth.

## Principle 4 — Wording must stay consistent

The same conceptual category should not get different names on every screen.

## Principle 5 — This should feel like product clarity, not internal debugging

The user should never feel like they’re reading engine internals.

---

# Category language spec

## Approved primary labels

### Declared

* `Declared`
* `Declared stop`
* `Declared overnight`
* `Custom title`

### Inferred

* `Engine-estimated`
* `Estimated by MEE`
* `MEE-estimated stop`
* `Engine support`

### Discovered

* `Suggested by MEE`
* `Nearby discovery`
* `Worth a look`
* `Optional stop`

## Preferred usage

Use the shortest clear phrasing that fits the surface.

Examples:

* tag/chip: `Declared`
* helper copy: `Engine-estimated fuel stop`
* discovery card label: `Suggested by MEE`

## Labels to avoid

* “auto-generated” everywhere
* “AI-generated”
* “system-generated” unless no better fit
* overly technical labels like “derived”
* inconsistent synonyms across screens

---

# Visual system spec

This design language must work through **multiple simultaneous signals**, not color alone.

## Design signals available

* color/accent family
* border weight
* fill treatment
* icon treatment
* chip/tag styling
* label wording
* opacity/emphasis
* card elevation
* type emphasis

The goal is not to use every signal at once.
The goal is to use enough signals that the category feels obvious and accessible.

---

# Declared visual treatment

## Visual role

Strongest authored-trip treatment.

## Desired feel

* anchored
* intentional
* trustworthy
* user-owned

## Recommended styling direction

* stronger border or stronger chip presence
* higher visual confidence
* slightly more contrast than inferred
* premium, grounded accent treatment
* more anchored icon/marker treatment on map

## In cards / rows

Declared items should feel:

* solid
* deliberate
* visually first-class

## In chips / labels

Examples:

* stronger filled chip
* more authoritative tag style
* clearer emphasis than inferred chips

## In maps

Declared markers should feel:

* more anchored
* more claimed
* more primary than inferred support stops

## Guardrails

* do not make declared styling loud or aggressive
* declared should feel premium, not alarm-like

---

# Inferred visual treatment

## Visual role

Supportive engine contribution.

## Desired feel

* helpful
* system-smart
* secondary to declared
* trustworthy but not dominant

## Recommended styling direction

* softer contrast than declared
* lighter chip or helper tag treatment
* more understated label styling
* slightly less visual weight in markers and cards

## In cards / rows

Inferred items should feel:

* integrated
* intelligible
* present, but not “the main decision”

## In chips / labels

Examples:

* outlined or softer filled chip
* clear but subdued status label
* helper-text support for what MEE did

## In maps

Inferred markers should feel:

* secondary to declared anchors
* clearly part of the trip if accepted
* not hidden, but not visually leading

## Guardrails

* inferred should not be visually mistaken for weak/noise
* users still need to trust it as part of the plan

---

# Discovered visual treatment

## Visual role

Optional enrichment / curiosity layer.

## Desired feel

* intriguing
* optional
* exploratory
* not yet canonical

## Recommended styling direction

* distinct accent family or optional-treatment style
* lighter card treatment than canonical trip structure
* optional/curious iconography
* secondary map marker language

## In cards / rows

Discovery surfaces should feel:

* inviting
* not required
* more playful/open-ended than declared or inferred structure

## In chips / labels

Examples:

* `Worth a look`
* `Nearby discovery`
* `Suggested by MEE`

## In maps

Discovery markers should feel:

* visible
* optional
* separate from actual trip anchors
* non-authoritative until accepted

## Guardrails

* discoveries must never look pre-accepted
* discoveries must not visually overpower actual trip structure

---

# Surface-by-surface requirements

## Surface 1 — Step 1

### Purpose

Clarify what the user is explicitly shaping versus what MEE will infer later.

### Required use

* declared stop roles must feel visually authored
* stops without role selection should feel inferable / passive
* trip title should reflect `Auto title` vs `Custom title`

### Examples

* stop with fuel + meal selected → clearly `Declared`
* stop with no role selected → subtle helper like `MEE will infer`
* custom title badge → `Custom title`
* untouched default title → `Auto title`

### Guardrails

* do not overload Step 1 with too many labels
* use category language sparingly but clearly

---

## Surface 2 — Results reveal

### Purpose

Show what MEE understood and built.

### Required use

* Layer 1 should remain mostly free of category clutter
* Layer 2 can use declared/inferred language where it helps explain trip shape

### Examples

* `Declared Dryden reset`
* `Engine-estimated fuel support`
* `Suggested by MEE` only if discovery is surfaced in reveal context

### Guardrails

* category language must not dilute the elegance of the hero reveal
* use only where it adds understanding

---

## Surface 3 — Signature Trip Summary Card

### Purpose

Keep the card elegant while still supporting source clarity where needed.

### Required use

* most category detail should stay out of the hero hierarchy
* only supporting route-feel or brief labels if truly useful

### Guardrails

* do not turn the summary card into a source-truth legend
* title and trip read remain the focus

---

## Surface 4 — Viewer

### Purpose

This is where source distinction becomes especially valuable.

### Required use

* declared stops should be visually stronger
* engine-estimated support stops should read as system-added
* optional discoveries should clearly feel separate from actual itinerary truth

### Examples

* timeline row label: `Declared`
* support stop helper: `Estimated by MEE`
* suggestion card: `Suggested by MEE`

### Guardrails

* keep the viewer readable
* do not badge every row if that creates noise
* use category treatment where it helps comprehension

---

## Surface 5 — Map

### Purpose

Make trip meaning visible spatially.

### Required use

* declared markers visually stronger
* inferred support markers softer
* discovery markers optional-feeling
* overnight anchors distinct where applicable

### Guardrails

* category distinction must not rely on color alone
* route clarity must remain primary

---

## Surface 6 — Print / PDF

### Purpose

Carry authorship clarity into the travel artifact.

### Required use

* declared stops should be labeled or visually framed as such
* engine-estimated supports should be identified cleanly where useful
* discoveries should only appear if truly part of the chosen output mode

### Examples

* `Declared stop`
* `Engine-estimated fuel`
* `Optional nearby discovery` only if print mode supports that concept

### Guardrails

* do not make the print document feel overly technical
* category cues should support reading, not clutter it

---

## Surface 7 — Discovery panels

### Purpose

This is where Discovered must be strongest as a concept.

### Required use

* discovery items must feel enticing but optional
* once accepted, their treatment should shift appropriately into trip truth

### Important rule

A discovered item that becomes part of the actual itinerary must transition out of “optional discovery” language and into the correct trip-truth category.

### Guardrails

* accepted discoveries must not keep looking like optional suggestion fluff
* rejected discoveries should not leave visual confusion

---

# Interaction behavior

## When a discovered item is accepted

It should visually transition from:

* optional discovery
  to
* trip truth (declared or accepted system-backed structure, depending on product rules)

This transition must be clear.

## When an inferred item becomes user-confirmed

If product logic supports confirming/accepting an inferred element, the visual language should update accordingly.

## When a declared item is removed or downgraded

The surface should no longer preserve its stronger authored styling.

---

# Hierarchy rules

## Rule 1

Declared > Inferred > Discovered
for trip authority and canonical importance.

## Rule 2

Discovered may be visually attractive, but never more authoritative than the real trip.

## Rule 3

Hero surfaces should use this language lightly.
Operational surfaces can use it more explicitly.

## Rule 4

Do not let categories become badge soup.

---

# Badge / chip system guidance

## Purpose

Provide a reusable compact visual system.

## Preferred chip roles

* `Declared`
* `Estimated by MEE`
* `Suggested by MEE`
* `Auto title`
* `Custom title`

## Rules

* use chips only where category matters
* do not add chips everywhere “because we have them”
* prefer one clear category indicator over multiple stacked statuses

---

# Accessibility / clarity rules

## Requirements

* category meaning must not rely on color alone
* icon/shape/label treatment should reinforce distinction
* selected state and category state must not become visually confusing
* text labels must remain readable and concise

## Guardrails

* decorative category styling must never reduce comprehension
* subtle is good, ambiguous is not

---

# Content and tone spec

## Tone

* calm
* premium
* clear
* confident
* never robotic

## Good phrasing examples

* `Declared stop`
* `Estimated by MEE`
* `Suggested by MEE`
* `Worth a look`
* `Auto title`
* `Custom title`

## Avoid

* “AI-generated”
* “System derived”
* “Auto-produced”
* anything that sounds like internal tooling language
* inconsistent synonyms like “predicted,” “derived,” “engine-generated,” “computed” all mixed together

---

# Canonical truth rules

This design language must reflect actual source-of-truth state.

The UI must not:

* call something declared if it was inferred
* call something inferred if it was discovered
* keep showing discovery styling after it has been accepted into trip truth
* invent source categories differently on different surfaces

Category treatment must follow real trip state.

---

# Edge cases

## No declared stops

Then the trip can still read as mostly engine-shaped. That is okay.

## Lots of inferred support stops

They must remain readable but not overpower the route.

## Discovery-heavy routes

Optional discovery must remain clearly secondary until accepted.

## Minimal/simple trips

Do not force category labels everywhere if the structure is already obvious.

---

# Guardrails

## Must not do

* turn the UI into a taxonomy chart
* create badge clutter
* use inconsistent wording across surfaces
* let optional discoveries masquerade as the actual itinerary
* make engine-estimated structure feel visually stronger than user-declared truth

## Must do

* make collaboration visible
* support trust
* support authorship
* keep the hierarchy clear
* remain elegant and premium

---

# Definition of done

This spec is done when:

* declared, inferred, and discovered elements are visually and verbally distinct
* the distinction is consistent across major surfaces
* users can understand source/meaning without reading a manual
* the system improves trust and clarity without making the UI noisy
* MEE’s collaborative intelligence becomes visible in a polished way

---

# Kitchen shorthand

## Problem

Trip elements currently risk feeling flattened together, which hides one of MEE’s strongest product advantages: collaborative trip authorship.

## Goal

Build a consistent design language that makes user-declared truth, engine-inferred support, and optional discoveries clearly distinguishable.

## Outcome

A more transparent, trustworthy, and premium-feeling product where MEE’s intelligence is visible — not just implied.
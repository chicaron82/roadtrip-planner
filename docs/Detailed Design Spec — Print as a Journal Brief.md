## Detailed Design Spec — Print as a Journey Brief

## Feature / phase name

**Print as a Journey Brief**

## Purpose

Transform MEE’s print/export output from a functional trip report into a **premium journey artifact**.

The printed output should feel like:

* something worth saving
* something worth sharing
* something easy to follow on the road
* something that reflects the trip’s identity, not just its logistics

This document should make the user feel:

> “This is the brief for the journey.”

Not:

> “This is a planner dump in PDF form.”

---

# Product problem

## Current problem

Traditional route/planning printouts often feel like:

* report output
* spreadsheet logic on paper
* dense lists of events
* admin artifacts rather than travel artifacts

Even if the information is technically correct, the experience can still feel flat.

For MEE, that is a missed opportunity because print is one of the highest-trust surfaces in the whole product. It is where the trip stops being just an app state and becomes:

* a handoff artifact
* a co-driver reference
* a pre-trip brief
* a saved memory of the trip

If print does not feel aligned with the Experience Engine promise, it weakens the whole product story.

## Why this matters

Print is where MEE has the chance to prove:

* clarity
* trustworthiness
* premium design taste
* artifact quality
* consistency with canonical trip truth

The PDF should feel like a document the user would genuinely want to keep in the glove box, send to a friend, or bring to the kitchen table.

---

# Design goal

## Core goal

Make the PDF/export feel like a **journey brief**, not a route report.

## Experience goal

The user should feel:

* oriented immediately
* proud of the trip
* confident in the route
* able to scan key day structure quickly
* able to distinguish what was declared vs inferred where relevant
* that the document reflects the same trip truth as the app

## Emotional goal

Print should feel:

* premium
* calm
* structured
* elegant
* practical
* roadworthy
* not ornate
* not sterile

---

# Success criteria

Print is successful when:

* the document opens with a strong trip identity
* the first page feels like a cover / brief, not a dump of stats
* days read like chapters of a journey
* the itinerary is easy to scan quickly
* declared vs inferred meaning is clear where useful
* driver handoffs and overnight points are human-readable
* the print artifact feels consistent with the app’s visual and editorial identity
* the print output is derived from canonical trip truth, not stitched together inconsistently

---

# Core UX concept

The document should be structured like a **travel brief**:

## Part 1 — Trip cover

What is this journey?

## Part 2 — Executive trip read

How does this trip work?

## Part 3 — Day chapters

How does the journey unfold?

## Part 4 — Supporting details

What practical facts matter along the way?

The user should be able to understand the trip in layers:

1. identity
2. shape
3. chapters
4. details

Do not flatten all of that into one report-style hierarchy.

---

# Print artifact identity

## The print document should feel like

* a premium route brief
* a roadtrip packet
* a journey plan
* a well-designed travel artifact

## The print document should not feel like

* a raw export
* a dev report
* a back-office itinerary sheet
* a spreadsheet with branding

---

# Document structure

## Required document sections

### Section 1 — Cover / title block

### Section 2 — High-level journey summary

### Section 3 — Day-by-day itinerary chapters

### Section 4 — Supporting travel detail blocks

This structure should remain stable so the print experience feels reliable and intentional.

---

# Section 1 — Cover / title block

## Purpose

Create a strong opening identity for the trip.

This should feel like the **front cover of the journey**.

## Required content

* trip title
* subtitle framing
* dates
* route framing
* trip read sentence
* key high-level trip facts

## Title behavior

Use canonical trip title.

### Auto title example

# `Your MEE time in Thunder Bay`

### Custom title example

# `Lake Superior Escape`

## Subtitle behavior

Use MEE signature framing.

Examples:

* `Your MEE time in Thunder Bay · Sep 12–15`
* `Built by MEE · Sep 12–15`

## Route framing

Examples:

* `Winnipeg → Thunder Bay`
* concise route identity only
* not a giant data header

## Trip Read sentence

This is highly recommended and should appear on the cover.

Examples:

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Comfort-first pacing with low stop pressure and strong shared-driver support.`

## Key trip facts

Keep this compact:

* drive time
* distance
* nights
* rooms
* mode
* driver count if useful

## Visual direction

* strongest hierarchy in the document
* title first
* route second
* trip read third
* practical facts fourth

## Guardrails

* do not open with a big utility stats table
* do not bury the title
* do not make the cover feel too app-like
* do not overfill the top page

---

# Section 2 — High-level journey summary

## Purpose

Give the reader a quick understanding of how the journey works before they hit the day-by-day breakdown.

## Required content

* trip health / route feel
* overnight summary
* driver structure summary
* declared stop highlights if useful
* any major trip strategy summary

## Examples

* `Balanced`
* `Shared-driver friendly`
* `2 nights in Thunder Bay`
* `Declared Dryden reset stop`
* `Low stop pressure overall`

## Visual direction

This should feel like the “executive summary” layer:

* calmer than the cover
* more practical
* still elegant
* still not dashboard-y

## Guardrails

* do not overload this section with every secondary metric
* keep it useful and skimmable
* do not duplicate the day-by-day itinerary

---

# Section 3 — Day-by-day itinerary chapters

## Purpose

Turn the itinerary into a readable sequence of travel chapters.

This is the heart of the document.

## Goal

Each day should feel like:

> a clear chapter in the trip

Not:

> a block of timestamped route events with weak hierarchy

---

# Day chapter structure

Each day should include:

## A. Day heading

Examples:

* `Day 1 — Outbound`
* `Day 2 — Thunder Bay`
* `Day 3 — Return`

If more specific editorial flavor is available and useful:

* `Day 1 — Outbound to Thunder Bay`
* `Day 2 — Explore & Reset`
* `Day 3 — Return West`

But keep it clear and not overly stylized.

## B. Day summary line

Concise support line with:

* total drive time for the day
* distance
* overnight outcome if relevant
* timezone shift if relevant

Example:
`Drive time 7h 58m · 700 km · Overnight in Thunder Bay`

## C. Main itinerary flow

Chronological itinerary with:

* departure
* major stops
* meals/fuel/overnight
* handoffs
* destination/arrival

## D. Day footer (optional)

Useful end-of-day note if relevant:

* comfort / pressure note
* overnight note
* summary of declared vs inferred structure if needed

---

# Itinerary event design

## Goal

Events must be easy to scan, follow, and understand quickly.

## Event hierarchy

1. time
2. event label
3. meaning / category
4. supporting details

## Event types should include

* departure
* drive segment
* declared stop
* inferred support stop
* overnight / hotel
* driver handoff
* discovery only if explicitly included in print mode
* timezone shift
* arrival

---

# Event labeling rules

## Declared stops

Must be clearly identified where useful.

Examples:

* `Declared stop — Dryden`
* `Declared fuel + meal stop`
* `Declared overnight anchor`

Do not over-label every event if the structure is already obvious, but when declared meaning matters, it should be visible.

## Inferred stops

Must read as engine support, not user authorship.

Examples:

* `Engine-estimated fuel stop`
* `Estimated by MEE`
* `Fuel support`

## Discovery items

Only include if the print mode intentionally supports enrichments.

If included:

* they must read as optional
* they must not visually look like mandatory itinerary structure

Examples:

* `Nearby discovery`
* `Suggested by MEE`
* `Worth a look`

---

# Driver handoff design

## Purpose

Make driver changes clear and human-readable.

## Goal

A printed route should show where the driver actually changes, not just that many drivers exist.

## Preferred wording

* `Driver handoff — Belle`
* `Driver handoff — DiZee`
* `Driving shifts to Tori`

Preferred default:
**`Driver handoff — [name]`**

## Rules

* handoff language should be calm and practical
* should align with actual finalized driver assignment truth
* should not be suggestion-based if the trip already has real driver rotation structure

## Guardrails

* do not print speculative swap suggestions as if they are actual handoffs
* handoffs must come from finalized trip truth

---

# Timezone shift design

## Purpose

Help roadtrip readability where time changes matter.

## Goal

Timezone changes should be easy to notice but not visually disruptive.

## Preferred wording

* `Enter GMT-4`
* `Enter GMT-5`
  or human-friendly local equivalent if supported later

## Placement

Attach to the relevant moment in the day flow.

## Rules

* timezone markers should come from canonical day/event grouping truth
* they should not appear inconsistently depending on legacy data paths

---

# Overnight block design

## Purpose

Make overnight points feel like major trip beats.

## Goal

Overnight sections should feel like:

> a meaningful transition in the journey

not just another line item.

## Required content

* overnight location
* hotel note or room setup if relevant
* arrival framing
* next-day transition clarity

## Examples

* `Overnight — Thunder Bay`
* `2 rooms reserved`
* `Rest and reset before the return leg`

## Visual direction

Overnight blocks should feel slightly more elevated than ordinary stops.

---

# Day chapter visual hierarchy

## Required hierarchy

1. day heading
2. day summary line
3. event flow
4. overnight / major anchor callouts
5. supporting detail notes

## Visual direction

* clean chapter separation
* clear day boundaries
* strong scanability
* enough spacing between events
* no dense “log wall”

## Guardrails

* do not compress the itinerary so much that all day events blur together
* do not let chapter headings feel weak or generic

---

# Section 4 — Supporting travel detail blocks

## Purpose

Provide practical detail that supports the trip without overloading the main itinerary flow.

## Candidate content

* driver roster summary
* accommodation summary
* trip health note
* room setup
* route mode
* key declared stops list
* emergency / travel notes if ever supported later

## Rules

* these should support the main brief, not overshadow it
* use compact, structured blocks
* do not duplicate what is already obvious from the itinerary

---

# Visual design direction

## Overall tone

* warm
* premium
* calm
* practical
* elegant
* trustworthy

## Stylistic inspiration

A travel brief, not a corporate report.

## Design principles

* strong title hierarchy
* elegant spacing
* chapter-based rhythm
* restrained accent use
* route-aware visual language
* no visual clutter

---

# Typography hierarchy

## Title

Largest, most elegant text on the page.

## Subtitle

Secondary, supportive, compact.

## Day headings

Strong and chapter-like.

## Event labels

Readable and practical.

## Supporting detail labels

Compact and subordinate.

## Rules

* title and day headings must do real hierarchy work
* event details should not compete with chapter structure
* avoid giant numerals that make print feel like a dashboard

---

# Content and tone spec

## Tone

Print should sound like MEE at its most composed:

* calm
* slightly more formal than live UI
* premium
* road-aware
* concise

## Good examples

* `A balanced 3-day roadtrip with a deliberate Dryden reset.`
* `Driver handoff — Belle`
* `Engine-estimated fuel support`
* `Overnight in Thunder Bay`
* `Shared-driver friendly`

## Avoid

* overly casual UI language
* dry systems language
* cluttered helper text
* repetitive filler headings

---

# Declared vs inferred print behavior

## Purpose

Carry authorship clarity into the artifact.

## Rules

* declared trip structure should read as user-authored
* inferred support should read as engine support
* discovery should remain optional if shown at all
* print should not erase the collaborative nature of the trip

## Important guardrail

Do not badge every line.
Use category language where it meaningfully helps comprehension.

---

# Canonical truth rules

This is critical.

Print must derive from finalized canonical trip truth.

It must not:

* invent alternate stop meanings
* rebuild handoff logic from unrelated summary hacks
* show labels that contradict actual trip state
* treat print as a separate interpretation engine

Print is a **formatter of truth**, not a second planner.

## Required consistency areas

* trip title
* route framing
* trip read
* declared/inferred meaning
* driver handoffs
* timezone shifts
* overnight structure

---

# Mobile / print-width considerations

Even though this is print, page width and readability still matter.

## Rules

* do not overfit too much content into a single row
* event lines must remain readable
* chapter structure should survive narrower layouts if exported differently
* avoid squeezing practical details into tiny footnote-style density

---

# Accessibility / readability rules

## Requirements

* category meaning must not rely on color alone
* print must remain usable in grayscale or poor printer conditions where possible
* hierarchy should survive without rich color rendering
* event scanability should remain strong

## Guardrails

* premium design must not reduce practical readability
* the brief must still work as a road document

---

# Edge cases

## Simple trip

If the trip is very simple:

* keep the structure elegant
* do not force filler content
* preserve the premium cover and chapter rhythm even with fewer details

## Complex trip

If the trip is complex:

* preserve readability
* do not let the event flow become visually unmanageable
* use chapter hierarchy and supporting detail sections to keep it under control

## No custom title

Auto title should still feel first-class.

## Discovery not included

The document should still feel complete and rich.

---

# Guardrails

## Must not do

* feel like a raw report
* front-load giant stat tables
* bury the title under logistics
* flatten days into generic lists
* mislabel suggestions as actual handoffs
* over-badge everything
* over-decorate at the cost of readability

## Must do

* open with strong trip identity
* make day structure feel chapter-based
* keep event flow easy to scan
* preserve canonical truth
* feel premium and roadworthy
* reward the user with an artifact worth keeping

---

# Definition of done

This spec is done when:

* the PDF opens with a strong cover / title block
* the trip reads like a journey brief, not a planner dump
* day-by-day sections feel like chapters
* declared vs inferred meaning is visible where useful
* handoffs, overnights, and timezone shifts are clear and trustworthy
* the document is elegant, practical, and consistent with canonical trip truth
* the artifact feels aligned with MEE’s Experience Engine promise

---

# Kitchen shorthand

## Problem

Current print/export risks feeling like a functional report rather than a premium travel artifact, weakening one of the highest-trust surfaces in the product.

## Goal

Make print feel like a journey brief: elegant, readable, trustworthy, and clearly aligned with the trip’s identity and structure.

## Outcome

A PDF/export surface that feels worth keeping, easy to follow, and unmistakably part of the MEE experience.

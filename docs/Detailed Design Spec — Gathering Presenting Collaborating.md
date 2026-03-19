# Detailed Design Spec — Gathering, Presenting, Collaborating
## The Three-Mode Arc After the Icebreaker

**Date:** March 18, 2026
**Status:** Whiteboard → Spec (refinement pass with DiZee expected)
**Origin:** Aaron + ZeeRah + Tori synthesis
**Scope:** Post-icebreaker flow. Does not replace the classic wizard — elevates users who came through the icebreaker into a continuous experience.

---

## The Problem

The icebreaker sets a tone. One question at a time. Map always present. Conversation, not form. The DNA strand building the trip as you answer.

Then you confirm and land in the classic wizard sidebar. StepsBanner. Tabs. Form fields.

The tonal whiplash is real. MEE just walked you through a premium entry experience and then handed you a laminated menu.

The wizard isn't wrong. The information it contains is correct. The *container* breaks the feeling.

**This spec defines the container that continues the conversation.**

---

## The Three-Mode Arc

Every interaction after the icebreaker belongs to one of three emotional modes. The user should never feel like they're switching apps between them.

```
GATHERING MODE
MEE is learning the trip.
The conversation continues.

        ↓

PRESENTING MODE
MEE is showing you what it built.
The voilà moment.

        ↓

COLLABORATING MODE
MEE and you are refining together.
Editing a presented plan, not filling out forms.
```

The classic wizard still exists. It becomes the advanced path inside Collaborating Mode — accessible, never the default landing for icebreaker users.

---

## GATHERING MODE — The Floating Cards

**Trigger:** Icebreaker completes. User has answered Where, When, Who. The map is full screen. The route is drawn. The DNA strand has yielded.

**What this is:** A lightweight continuation of the icebreaker aesthetic. Compact cards floating over the map, one surface at a time, asking only what's needed before MEE can calculate.

**What this is NOT:** The wizard. No StepsBanner. No tabs. No sidebar. The map stays.

### The Cards

**Card 1 — Your Ride**
Surfaces immediately after icebreaker completion.

```
What are you driving?

[ 🚗 Sedan ] [ 🚙 SUV ] [ 🛻 Truck ] [ 🚐 Van ] [ ⚡ Hybrid ]

My vehicle →   (opens garage if they have saved vehicles)
```

- If a default vehicle exists in the garage → pre-selected, card shows confirmation: "Driving your [Year Make Model] — looks right?" with a checkmark to confirm or swap.
- Advance: tap a preset or confirm the garage vehicle. Card dismisses.
- Skip available: "Use defaults →" applies the sedan baseline silently.

**Card 2 — Your Budget** *(optional, conditional)*
Only surfaces if the user hasn't set a budget. If they already came through Estimate Mode or have a default, skip entirely.

```
Planning to a budget?

[ No — just show me the cost ]   [ Yes → $_______ ]
```

- Two-tap max. Most users tap "No" and move on.
- Card dismisses either way.

**Calculate button** — visible throughout, not inside a card. Floated at the bottom of the screen, always accessible. As soon as the icebreaker completes, the button is live. Cards are optional refinements, not gates.

```
[ Calculate my MEE time → ]
```

The user can skip both cards entirely and hit Calculate immediately. The cards are a fast path for common tweaks, not mandatory checkpoints.

### Visual Language

Same glass aesthetic as the icebreaker. `landing-screen` + `landing-bg-overlay` CSS classes — DiZee already established this pattern in `EstimateWorkshop.tsx` and `IcebreakerGate.tsx`. Free to reuse.

Cards float centered over the map, max-width 420px. Fade in on appear, fade out on dismiss. The map is always visible behind them.

**Not a new component from scratch.** The card container pattern matches the existing icebreaker overlay. New content, same shell.

### Implementation Note

`useIcebreakerGate.ts` already manages the icebreaker state. Add a `gatheringActive` state that activates after icebreaker completion and deactivates when Calculate fires. The floating cards render when `gatheringActive` is true and `!tripMode` (same conditional block as the icebreaker).

---

## PRESENTING MODE — The Voilà Moment

**Trigger:** User taps "Calculate my MEE time →"

**What this is:** MEE takes over. The user waits. MEE works. Then MEE presents.

This is the moment the whole flow has been building toward. It should feel like a curtain rising, not a page loading.

### The Building State

Currently: spinner or standard loading in the sidebar.

**V2:** MEE speaks while it works.

The map stays full screen. The floating cards dismiss. Centered over the map, a single surface:

```
                    ✦

        Building your MEE time...

  Routing from Winnipeg to Vancouver…
  [fades to next message every 900ms]
  Mapping your stops through Calgary…
  Checking the roads ahead…
  Almost there…
```

`useCalculationMessages` already produces location-aware rotating messages. This just gives them the right stage — full screen, centered, no competing UI.

The small ✦ (or MEE's amber dot) above the message. Subtle pulse. Alive, not anxious.

**Duration:** As long as `isCalculating` is true. No fake delays.

### The Reveal Sequence

When calculation completes, `isCalculating` flips false. The reveal fires.

**Currently:** Step 3 loads in the sidebar. `useRevealAnimation` staggers three layers at 0/150/280ms. This is already built and correct.

**V2:** The presentation happens *before* the sidebar appears.

1. **Building state fades out** (200ms) — the message surface dissolves.

2. **Full-screen presentation moment** (new) — before the sidebar slides in:
   - Map dims slightly (opacity 1.0 → 0.7, 300ms)
   - Centered over the map, the TripSignatureCard blooms in — same component, full-screen presentation context
   - Subtitle beneath: the `buildResultsFramingLine(tripMode)` copy. Adventure: *"A strong plan, shaped around your intent."* Plan: *"Your route structure, supported by MEE."*
   - Hold for ~1.5 seconds (or until user taps)

3. **Sidebar slides in** (400ms) — map returns to normal opacity, sidebar animates in from the right (or bottom on mobile), Step 3 content loads with existing `useRevealAnimation` stagger.

4. **The route polyline draws** — `AnimatedPolyline` already handles this. Make sure it fires during step 3, not before.

**Total feel:** ~2 seconds from calculation complete to interactive. Deliberate. Not slow.

**Emotional target:** *"Oh shit — now it's real."*

The full-screen signature card moment is the voilà. MEE presenting the trip before handing over control. Not a page load. A presentation.

### Implementation Note

A new `presentingMode` boolean in `useIcebreakerGate` (or a new `usePresentationMode` hook). Activates when calculation completes for users who came through the icebreaker. Deactivates after the hold period or on user tap. The full-screen presentation surface renders during `presentingMode === true`.

**Classic wizard users (escape hatch):** No full-screen presentation. They came through the standard flow. `useRevealAnimation` fires as normal in the sidebar. The presentation mode only activates for icebreaker users.

---

## COLLABORATING MODE — Refine Your MEE Time

**Trigger:** Presentation moment completes. Sidebar is now visible. User is in Step 3.

**What this is:** The existing Step 3 — but reframed, and with one new surface.

The reframe is mostly copy and structure. The information is already there. The container just needs to stop saying "continue setup" and start saying "this is your plan, make it yours."

### The Reframe

**Current Step 3 language:**
- "Ready to go?" (ConfirmTripCard unconfirmed state)
- "Confirm Trip" (button)

**Collaborating Mode language (icebreaker users):**
- "Your MEE time is ready." (replaces "Ready to go?")
- "Make it yours →" secondary actions surface
- "Lock it in" (replaces "Confirm Trip")

These are copy changes to `ConfirmTripCard` that are conditional on whether the user came through the icebreaker (`icebreakerOrigin` flag, already available via `useIcebreakerGate`).

### The Tune Panel

**New surface:** Between the health section and the commit card, a compact "Tune this trip" panel for icebreaker users.

Not a form. A set of one-tap adjustments:

```
Tune this trip

[ 🐢 More relaxed ]   [ 🚀 Push harder ]
[ 🏨 Upgrade hotels ] [ 💸 Save on hotels ]
[ 🌿 More scenic ]    [ ⚡ Fastest route ]
```

Each button fires a preset adjustment and triggers a recalculation:
- **More relaxed** → reduce `maxDriveHours` by 1, increase stop frequency to comfortable
- **Push harder** → increase `maxDriveHours` by 1, reduce stop frequency to aggressive
- **Upgrade hotels** → bump hotel tier one level
- **Save on hotels** → drop hotel tier one level
- **More scenic** → toggle `scenicMode` on
- **Fastest route** → toggle `scenicMode` off

These are all settings that already exist. This surface just makes them one-tap instead of buried in the classic wizard.

**Important:** Show only the adjustments that make sense for the current trip. No "upgrade hotels" if already at premium. No "push harder" if already at max drive hours. Logic lives in a simple `buildTuneOptions()` function.

**After any adjustment:** The LiveReflectionBar (already built) updates immediately. The recalculation fires. The itinerary updates. No page navigation.

**"See all settings →"** link at the bottom of the Tune panel opens the classic wizard at Step 2. Always available. Never the first option.

### What Stays Exactly As Is

- `TripSignatureCard` — no changes
- `TripArrivalHero` — no changes
- `FeasibilityBanner` — no changes
- `TripViewer` / itinerary — no changes
- `TripBottomActions` — no changes (Google Maps, Share, Print, Export)
- `BudgetBar` — no changes
- `Step3HistorySection` — no changes
- `useRevealAnimation` — no changes
- Journal mode — no changes

The Collaborating Mode is additive. It inserts the Tune panel and changes some copy. It doesn't replace anything.

---

## What's New (Summary)

| New Element | Where | What |
|-------------|-------|------|
| Floating cards | `src/components/Icebreaker/GatheringCards.tsx` | Vehicle + budget quick-select over map |
| Building state surface | `src/components/Icebreaker/PresentingOverlay.tsx` | Full-screen calc messages over map |
| Full-screen voilà moment | `src/components/Icebreaker/VoilaPresentation.tsx` | Signature card bloom before sidebar |
| `gatheringActive` state | `useIcebreakerGate.ts` | Controls floating cards visibility |
| `presentingMode` state | `useIcebreakerGate.ts` or new hook | Controls voilà sequence |
| `icebreakerOrigin` flag | `useIcebreakerGate.ts` | Passed to Step 3 for copy + tune panel |
| Tune panel | `src/components/Steps/TunePanel.tsx` | One-tap trip adjustments |
| `buildTuneOptions()` | `src/lib/tune-options.ts` | Pure function, test required |

---

## What's Conditional on `icebreakerOrigin`

These only activate for users who came through the icebreaker. Classic wizard users see the existing experience unchanged.

- Floating cards (Gathering Mode)
- Full-screen building state (Presenting Mode)
- Voilà presentation moment (Presenting Mode)
- Tune panel in Step 3 (Collaborating Mode)
- Copy changes in ConfirmTripCard ("Lock it in" vs "Confirm Trip")

---

## The Escape Hatch — Always Available

At every stage:

- **Gathering:** "Switch to full planner →" on each card
- **Presenting:** Tap anywhere to skip voilà hold and go straight to sidebar
- **Collaborating:** "See all settings →" at bottom of Tune panel

Power users are never trapped. The classic wizard is one tap away at all times.

---

## Implementation Order

1. **`gatheringActive` + floating cards** — Gathering Mode. Start here because it immediately fixes the tonal whiplash on icebreaker completion.
2. **Building state surface** — Presenting Mode step 1. Full-screen calc messages.
3. **Voilà moment** — Presenting Mode step 2. The signature card bloom.
4. **`icebreakerOrigin` flag + copy changes** — Collaborating Mode step 1. Low effort, high emotional impact.
5. **`buildTuneOptions()` + Tune panel** — Collaborating Mode step 2. The refinement surface.

---

## Design Principles to Hold

**The map never disappears until the user is ready.** Gathering and Presenting both keep the map full screen. The sidebar only appears when MEE is done presenting and the user is ready to explore.

**MEE presents, then collaborates.** The voilà moment is MEE's turn. After that, control shifts to the user. The Tune panel is where that collaboration begins.

**Editing a plan feels different from filling out a form.** "More relaxed / Push harder" is an editorial instruction. It's how you'd tell a travel companion to adjust the itinerary. "Max drive hours per day" is a form field. Same outcome, completely different feeling.

**One tap should always be enough.** Every Tune panel option fires immediately. No confirmation, no modal. The LiveReflectionBar shows the effect instantly. If they don't like it, they tap the opposite.

**`icebreakerOrigin` is the dividing line.** Users who skipped the icebreaker get the existing experience, unchanged. This is an enhancement for the conversational path, not a replacement for the classic path.

---

## Open Questions for DiZee

1. Does the voilà full-screen moment live in a new component or does it extend the existing `PresentingOverlay`?
2. Should the building state surface (centered calc messages over map) replace the existing sidebar loading state, or run in parallel for icebreaker users only?
3. `buildTuneOptions()` — does it live in `src/lib/` (pure function, testable) or inline in `TunePanel.tsx`? Lean toward `src/lib/` with a test.
4. The floating vehicle card — does it pull from `getDefaultVehicleId()` automatically, or does the user always see the preset options first?
5. Mobile: the voilà full-screen presentation — does it scale down the signature card or present a simplified version?

---

💚 My Experience Engine — Built by Aaron "Chicharon" with the UV7 crew
*Synthesized from Aaron's instinct, ZeeRah's architecture, and Tori's emotional framing.*

/**
 * mode-voice.ts — Mode-aware copy builders for Auto vs Manual mood separation.
 *
 * Auto (`adventure`) feels:  guided · MEE-led · confident · interpretive
 * Manual (`plan`) feels:     authored · user-led · deliberate · precise
 * Estimate (`estimate`) follows the plan/manual copy as a sensible default.
 *
 * All builders are pure functions — no component logic, no imports.
 * Surfaces consume these to produce mode-aware framing without forking structure.
 *
 * 💚 Auto vs Manual Mode Mood Separation — MEE Design Language
 */

import type { TripMode } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Results reveal framing line (Step 3 header subtitle)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the framing line shown beneath the "Your Trip" heading in Step 3.
 *
 * Auto:   engine-confidence-forward — "MEE built this for you"
 * Manual: authorship-forward        — "You shaped this; MEE supported"
 */
export function buildResultsFramingLine(tripMode: TripMode): string {
  switch (tripMode) {
    case 'adventure':
      return 'A strong plan, shaped around your intent.';
    case 'plan':
    case 'estimate':
    default:
      return 'Your route structure, supported by MEE.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sketch card framing line (Beat 2 — "Let MEE sketch this out")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the subline beneath the sketch card numbers in Beat 2.
 * MEE just computed a rough estimate — this frames what it did.
 */
export function buildSketchFramingLine(tripMode: TripMode): string {
  switch (tripMode) {
    case 'adventure':
      return 'MEE drew the first outline. Ready to shape it?';
    case 'plan':
    case 'estimate':
    default:
      return 'A rough shape of your trip. Make it personal, or calculate now.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Confirm card subline (ConfirmTripCard supporting copy)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the supporting subline in the confirm-trip card, beneath the
 * day count and stop count line.
 *
 * Auto:   highlights engine contribution and user intent
 * Manual: validates user authorship and engine support role
 */
export function buildConfirmSubline(tripMode: TripMode): string {
  switch (tripMode) {
    case 'adventure':
      return 'MEE built this around what matters to you. Lock it in.';
    case 'plan':
    case 'estimate':
    default:
      return 'You shaped this route. MEE helped make it hold. Lock it in.';
  }
}

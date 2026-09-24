/**
 * MEE Tokens — Single source of truth for labels, voice copy, and source-tier metadata.
 *
 * Three export groups, one file each (split 2026-09-23 — the single file had passed the 330-line cap):
 *   1. SOURCE_TIER   (source-tier.ts)    — Declared / Inferred / Discovered / Verified chip/label constants
 *   2. Voice builders (voice-builders.ts) — Typed functions that produce interpretive copy
 *   3. Vocabulary     (vocabulary.ts)    — String union types that enforce the voice spec at compile time
 *
 * No component logic lives here. Pure data + pure functions.
 * All surfaces (viewer, print, results, map, Step 1) derive copy from this module.
 *
 * 💚 "MEE sounds like a journey editor, not a trip calculator." — Editorial Voice Spec
 */

export * from './source-tier';
export * from './vocabulary';
export * from './voice-builders';

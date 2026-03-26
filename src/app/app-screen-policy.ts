/**
 * app-screen-policy.ts — Authority rules for MEE screen and overlay state.
 *
 * Pure functions only. No React. No hooks. No side effects.
 * These are the single source of truth for "who wins?" questions.
 *
 * 💚 My Experience Engine — Headquarters policy layer
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type ActiveSurface =
  | 'landing'
  | 'planning'
  | 'templatePreview'
  | 'voila'
  | 'journalAtAGlance'
  | 'icebreaker';

export interface OverlayState {
  shareScreen: boolean;
  adventureMode: boolean;
  icebreakerOverlays: boolean;
  sessionRestoreMask: boolean;
}

export interface UIFlags {
  shouldMountPlannerShell: boolean;
  shouldDimBackground: boolean;
  shouldShowRouteStrategy: boolean;
  shouldShowTripSummaryCard: boolean;
  shouldHidePlannerUI: boolean;
  ghostCarActive: boolean;
}

// ── Input state shape ──────────────────────────────────────────────────────

export interface ScreenPolicyState {
  showVoila: boolean;
  pendingTemplate: boolean;
  showJournalAtAGlance: boolean;
  tripMode: string | null;
  arcActive: boolean;
  showShareScreen: boolean;
  showAdventureMode: boolean;
  planningStep: number;
  tripConfirmed: boolean;
  hasSummary: boolean;
}

// ── Authority functions ────────────────────────────────────────────────────

/**
 * The single authoritative answer for what the main surface is.
 * Priority: voila > templatePreview > journalAtAGlance > planning > icebreaker > landing
 */
export function getActiveSurface(state: ScreenPolicyState): ActiveSurface {
  if (state.showVoila) return 'voila';
  if (state.pendingTemplate) return 'templatePreview';
  if (state.showJournalAtAGlance) return 'journalAtAGlance';
  if (state.tripMode) return 'planning';
  if (state.arcActive) return 'icebreaker';
  return 'landing';
}

/**
 * What overlay layers are active on top of the main surface.
 */
export function getOverlayState(state: ScreenPolicyState): OverlayState {
  return {
    shareScreen: state.showShareScreen,
    adventureMode: state.showAdventureMode,
    icebreakerOverlays: state.arcActive,
    sessionRestoreMask: false,
  };
}

/**
 * Derived UI flags for the renderer. No logic in JSX.
 *
 * Z2 FIX: shouldMountPlannerShell includes journalAtAGlance — the shell
 * must stay mounted during journal mode so ghost car state is preserved.
 */
export function getUIFlags(state: ScreenPolicyState): UIFlags {
  const surface = getActiveSurface(state);
  return {
    shouldMountPlannerShell: surface === 'planning' || surface === 'journalAtAGlance',
    shouldDimBackground: surface === 'planning',
    shouldShowRouteStrategy: surface === 'planning' && state.planningStep === 3 && state.hasSummary,
    shouldShowTripSummaryCard: surface === 'planning' && state.planningStep === 3 && state.hasSummary,
    shouldHidePlannerUI: surface === 'journalAtAGlance',
    ghostCarActive: state.tripConfirmed && state.planningStep === 3 && state.hasSummary,
  };
}

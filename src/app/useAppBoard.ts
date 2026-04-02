/**
 * useAppBoard.ts — MEE headquarters.
 *
 * Reads from franchise CEOs and produces the complete board state:
 *   - activeSurface: what the main screen is
 *   - overlayState: what secondary layers are active
 *   - commands: clean command surface for the renderer
 *   - uiFlags: derived booleans, no logic in JSX
 *   - props bundles for each surface
 *
 * Franchises own state. The board owns authority. The renderer owns presentation.
 *
 * 💚 My Experience Engine — Headquarters
 */

import type { ComponentProps } from 'react';
import {
  getActiveSurface,
  getOverlayState,
  getUIFlags,
  type ActiveSurface,
  type OverlayState,
  type UIFlags,
} from './app-screen-policy';
import type { TemplateImportResult } from '../lib/url';
import type { TripSummary, TripSettings, Location, TripJournal } from '../types';
import type { TimedEvent } from '../lib/trip-timeline';
import type { PrintInput } from '../lib/canonical-trip';
import type { FeasibilityResult } from '../lib/feasibility';
import type { GhostCarState } from '../hooks';
import type { IcebreakerOverlayProps } from '../components/Icebreaker/IcebreakerOverlays';
import type { PlannerFullscreenShellProps } from '../components/App/PlannerFullscreenShell';
import type { RouteStrategyPicker } from '../components/Trip/RouteStrategyPicker';
import type { TripSummaryCard } from '../components/Trip/TripSummary';
import type { LandingScreenProps } from '../components/Landing/LandingScreen';

// ── Named props bundle interfaces (Z1) ────────────────────────────────────

export interface VoilaPropsBundle {
  summary: TripSummary;
  settings: TripSettings;
  locations: Location[];
  customTitle?: string | null;
  printInput?: PrintInput;
  precomputedEvents?: TimedEvent[];
  feasibility?: FeasibilityResult;
}

export interface JournalAtAGlancePropsBundle {
  summary: TripSummary;
  settings: TripSettings;
  activeJournal: TripJournal | null;
  ghostCar: GhostCarState;
  onUpdateJournal: (journal: TripJournal) => void;
}

export interface PostTripPropsBundle {
  journal: TripJournal | null;
  summary: TripSummary;
  settings: TripSettings;
  onStartJournal?: (title?: string) => void;
}

export interface PlannerPropsBundle extends PlannerFullscreenShellProps {
  routeStrategyProps: ComponentProps<typeof RouteStrategyPicker>;
  tripSummaryProps: ComponentProps<typeof TripSummaryCard>;
}

// ── Input type ────────────────────────────────────────────────────────────

export interface AppBoardInputs {
  // ── Voilà CEO
  showVoila: boolean;
  showShareScreen: boolean;
  handleOpenShareScreen: () => void;
  handleCloseShareScreen: () => void;
  handleVoilaEdit: () => void;
  handleVoilaLockIn: () => void;
  handleSkipJournal: () => void;
  handleGoHome: () => void;
  handleViewFullDetails: () => void;
  handleFinalizeJournal: () => void;
  handleStartFresh: () => void;
  handleMinimizeToVoila: () => void;
  handleReturnToJournal: () => void;
  handleExitToTripDetails: () => void;

  // ── Template / Trip Loader CEO
  pendingTemplate: TemplateImportResult | null;
  handleBuildFromTemplate: (modified: TemplateImportResult) => void;
  handleOpenPlannerFromTemplate: (modified: TemplateImportResult) => void;
  handleDismissPendingTemplate: () => void;

  // ── Planner CEO
  tripMode: string | null;
  planningStep: number;
  tripConfirmed: boolean;
  hasSummary: boolean;

  // ── Icebreaker CEO
  arcActive: boolean;
  icebreakerOverlayProps: IcebreakerOverlayProps;

  // ── Session CEO
  showAdventureMode: boolean;
  showJournalAtAGlance: boolean;
  showPostTrip: boolean;

  // ── Props bundles (Z1: explicitly typed)
  voilaProps: VoilaPropsBundle;
  plannerProps: PlannerPropsBundle;
  templatePreviewProps: { pendingTemplate: TemplateImportResult | null };
  journalAtAGlanceProps: JournalAtAGlancePropsBundle;
  postTripProps: PostTripPropsBundle | null;
  landingProps: LandingScreenProps;
}

// ── Output type ───────────────────────────────────────────────────────────

export interface AppBoard {
  activeSurface: ActiveSurface;
  overlayState: OverlayState;
  uiFlags: UIFlags;
  commands: AppBoardCommands;
  voilaProps: VoilaPropsBundle;
  plannerProps: PlannerPropsBundle;
  templatePreviewProps: { pendingTemplate: TemplateImportResult | null };
  journalAtAGlanceProps: JournalAtAGlancePropsBundle;
  postTripProps: PostTripPropsBundle | null;
  landingProps: LandingScreenProps;
  icebreakerOverlayProps: IcebreakerOverlayProps;
  pendingTemplate: TemplateImportResult | null;
}

export interface AppBoardCommands {
  buildFromTemplate: (modified: TemplateImportResult) => void;
  openPlannerFromTemplate: (modified: TemplateImportResult) => void;
  dismissTemplatePreview: () => void;
  openShareScreen: () => void;
  closeShareScreen: () => void;
  editVoila: () => void;
  lockInVoila: () => void;
  skipJournal: () => void;
  viewFullDetails: () => void;
  goHome: () => void;
  finalizeJournal: () => void;
  startFresh: () => void;
  minimizeToVoila: () => void;
  returnToJournal: () => void;
  exitToTripDetails: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAppBoard(inputs: AppBoardInputs): AppBoard {
  const policyState = {
    showVoila: inputs.showVoila,
    pendingTemplate: inputs.pendingTemplate !== null,
    showJournalAtAGlance: inputs.showJournalAtAGlance,
    showPostTrip: inputs.showPostTrip,
    tripMode: inputs.tripMode,
    arcActive: inputs.arcActive,
    showShareScreen: inputs.showShareScreen,
    showAdventureMode: inputs.showAdventureMode,
    planningStep: inputs.planningStep,
    tripConfirmed: inputs.tripConfirmed,
    hasSummary: inputs.hasSummary,
  };

  return {
    activeSurface: getActiveSurface(policyState),
    overlayState: getOverlayState(policyState),
    uiFlags: getUIFlags(policyState),
    commands: {
      buildFromTemplate: inputs.handleBuildFromTemplate,
      openPlannerFromTemplate: inputs.handleOpenPlannerFromTemplate,
      dismissTemplatePreview: inputs.handleDismissPendingTemplate,
      openShareScreen: inputs.handleOpenShareScreen,
      closeShareScreen: inputs.handleCloseShareScreen,
      editVoila: inputs.handleVoilaEdit,
      lockInVoila: inputs.handleVoilaLockIn,
      skipJournal: inputs.handleSkipJournal,
      viewFullDetails: inputs.handleViewFullDetails,
      goHome: inputs.handleGoHome,
      finalizeJournal: inputs.handleFinalizeJournal,
      startFresh: inputs.handleStartFresh,
      minimizeToVoila: inputs.handleMinimizeToVoila,
      returnToJournal: inputs.handleReturnToJournal,
      exitToTripDetails: inputs.handleExitToTripDetails,
    },
    voilaProps: inputs.voilaProps,
    plannerProps: inputs.plannerProps,
    templatePreviewProps: inputs.templatePreviewProps,
    journalAtAGlanceProps: inputs.journalAtAGlanceProps,
    postTripProps: inputs.postTripProps,
    landingProps: inputs.landingProps,
    icebreakerOverlayProps: inputs.icebreakerOverlayProps,
    pendingTemplate: inputs.pendingTemplate,
  };
}

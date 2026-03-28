/**
 * useAppWiring — Root wiring orchestrator for AppRenderer.
 *
 * Coordinates the two sub-wiring concerns and composes the final output:
 *   - usePlannerWiring: step/map/context/adventure props
 *   - useAppBoard: surface + overlay authority (headquarters)
 *
 * Also assembles the named prop bundles that useAppBoard consumes
 * (voilaProps, plannerProps, journalAtAGlanceProps, postTripProps, landingProps)
 * and derives shareScreenProps from stepProps.
 *
 * No business logic. Pure prop threading.
 *
 * 💚 My Experience Engine — Wiring Orchestrator
 */

import type { ComponentProps } from 'react';
import type { MakeMEETimeScreen } from '../components/Trip/Sharing/MakeMEETimeScreen';
import { useAppBoard } from './useAppBoard';
import { usePlannerWiring } from './usePlannerWiring';

// Re-export types so callers (App.tsx) keep a single import path.
export type { AppWiringInputs, AppWiringOutput } from './useAppWiring.types';
import type { AppWiringInputs, AppWiringOutput } from './useAppWiring.types';

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAppWiring(i: AppWiringInputs): AppWiringOutput {
  // ── Derived surface flags ─────────────────────────────────────────────
  const showPostTrip = !!i.activeJournal?.finalized && i.tripConfirmed && !i.showVoila;
  const showJournalAtAGlance =
    i.tripConfirmed && i.viewMode === 'journal' && !i.showVoila && !!i.activeJournal && !showPostTrip;

  // ── Planner wiring ────────────────────────────────────────────────────
  const {
    stepProps, mapProps, adventureModeProps, plannerContextValue,
    handleBuildFromTemplate, handleOpenPlannerFromTemplate,
  } = usePlannerWiring(i);

  // ── Board (headquarters) ──────────────────────────────────────────────
  const board = useAppBoard({
    showVoila: i.showVoila, showShareScreen: i.showShareScreen,
    handleOpenShareScreen: i.handleOpenShareScreen, handleCloseShareScreen: i.handleCloseShareScreen,
    handleVoilaEdit: i.handleVoilaEdit, handleVoilaLockIn: i.handleVoilaLockIn,
    handleGoHome: i.handleGoHome, handleViewFullDetails: i.handleViewFullDetails,
    handleFinalizeJournal: i.finalizeJournal,
    handleStartFresh: () => { i.resetTripSession(); i.handleGoHome(); },
    handleMinimizeToVoila: i.handleMinimizeToVoila,
    handleReturnToJournal: i.handleReturnToJournal,
    handleExitToTripDetails: () => i.setViewMode('plan'),
    pendingTemplate: i.pendingTemplate, handleBuildFromTemplate, handleOpenPlannerFromTemplate,
    handleDismissPendingTemplate: i.handleDismissPendingTemplate,
    tripMode: i.tripMode, planningStep: i.planningStep,
    tripConfirmed: i.tripConfirmed, hasSummary: !!i.summary,
    arcActive: i.icebreaker.arcActive,
    icebreakerOverlayProps: i.icebreaker.overlayProps,
    showAdventureMode: i.showAdventureMode, showJournalAtAGlance, showPostTrip,
    // ── Named prop bundles ──────────────────────────────────────────────
    voilaProps: {
      summary: i.summary!,
      settings: i.settings,
      locations: i.locations,
      customTitle: i.customTitle,
      printInput: stepProps.step3Props.controller.commit?.printInput ?? undefined,
      precomputedEvents: stepProps.step3Props.controller.commit?.precomputedEvents ?? undefined,
      feasibility: stepProps.step3Props.controller.feasibility ?? undefined,
    },
    plannerProps: {
      onRevealChange: i.setMapRevealed,
      stepProps,
      liveReflection: i.summary ? { summary: i.summary, vehicle: i.vehicle, settings: i.settings } : null,
      routeStrategyProps: {
        strategies: i.routeStrategies,
        activeIndex: i.activeStrategyIndex,
        onSelect: i.selectStrategy,
        units: i.settings.units,
        isRoundTrip: i.settings.isRoundTrip,
      },
      tripSummaryProps: {
        summary: i.summary!,
        settings: i.settings,
        tripActive: i.tripActive,
        onStop: () => i.setTripActive(false),
        onOpenVehicleTab: () => i.goToStep(2),
      },
    },
    templatePreviewProps: { pendingTemplate: i.pendingTemplate },
    journalAtAGlanceProps: {
      summary: i.summary!,
      settings: i.settings,
      activeJournal: i.activeJournal,
      ghostCar: i.ghostCar,
      onUpdateJournal: i.updateActiveJournal,
    },
    postTripProps: i.activeJournal?.finalized && i.summary ? {
      journal: i.activeJournal,
      summary: i.summary,
      settings: i.settings,
    } : null,
    landingProps: {
      onSelectMode: i.icebreaker.handleLandingSelect,
      hasSavedTrip: i.history.length > 0,
      onContinueSavedTrip: () => i.setTripMode('plan'),
      hasActiveSession: i.hasActiveSession,
      onResumeSession: i.handleResumeSession,
      lastDestination: i.lastDestination,
    },
  });

  // ── Share screen props ────────────────────────────────────────────────
  // Depends on stepProps (from planner wiring) — must stay in the orchestrator.
  const shareScreenProps: Omit<ComponentProps<typeof MakeMEETimeScreen>, 'onClose'> | null =
    stepProps.step3Props.controller.commit?.printInput ? {
      printInput: stepProps.step3Props.controller.commit.printInput,
      journal: i.activeJournal,
      tripOrigin: i.tripOrigin,
    } : null;

  return {
    board,
    mapProps,
    adventureModeProps,
    plannerContextValue,
    shareScreenProps,
    flyoverActive: i.flyoverActive,
    handleFlyoverComplete: i.handleFlyoverComplete,
  };
}

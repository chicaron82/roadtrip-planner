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
  const showPostTrip = !!i.journal.activeJournal?.finalized && i.session.tripConfirmed && !i.voila.showVoila;
  const showJournalAtAGlance =
    i.session.tripConfirmed && i.journal.viewMode === 'journal' && !i.voila.showVoila && !!i.journal.activeJournal && !showPostTrip;

  // ── Planner wiring ────────────────────────────────────────────────────
  const {
    stepProps, mapProps, adventureModeProps, plannerContextValue,
    handleBuildFromTemplate, handleOpenPlannerFromTemplate,
  } = usePlannerWiring(i);

  // ── Board (headquarters) ──────────────────────────────────────────────
  const board = useAppBoard({
    showVoila: i.voila.showVoila, showShareScreen: i.voila.showShareScreen,
    handleOpenShareScreen: i.voila.handleOpenShareScreen, handleCloseShareScreen: i.voila.handleCloseShareScreen,
    handleVoilaEdit: i.voila.handleVoilaEdit, handleVoilaLockIn: i.voila.handleVoilaLockIn,
    handleGoHome: i.voila.handleGoHome, handleViewFullDetails: i.voila.handleViewFullDetails,
    handleFinalizeJournal: i.journal.finalizeJournal,
    handleStartFresh: () => { i.session.resetTripSession(); i.voila.handleGoHome(); },
    handleMinimizeToVoila: i.voila.handleMinimizeToVoila,
    handleReturnToJournal: i.voila.handleReturnToJournal,
    handleExitToTripDetails: () => i.journal.setViewMode('plan'),
    pendingTemplate: i.tripLoader.pendingTemplate, handleBuildFromTemplate, handleOpenPlannerFromTemplate,
    handleDismissPendingTemplate: i.tripLoader.handleDismissPendingTemplate,
    tripMode: i.tripMode.tripMode, planningStep: i.wizard.planningStep,
    tripConfirmed: i.session.tripConfirmed, hasSummary: !!i.tripContext.summary,
    arcActive: i.features.icebreaker.arcActive,
    icebreakerOverlayProps: i.features.icebreaker.overlayProps,
    showAdventureMode: i.tripMode.showAdventureMode, showJournalAtAGlance, showPostTrip,
    // ── Named prop bundles ──────────────────────────────────────────────
    voilaProps: {
      summary: i.tripContext.summary!,
      settings: i.tripContext.settings,
      locations: i.tripContext.locations,
      customTitle: i.tripContext.customTitle,
      printInput: stepProps.step3Props.controller.commit?.printInput ?? undefined,
      precomputedEvents: stepProps.step3Props.controller.commit?.precomputedEvents ?? undefined,
      feasibility: stepProps.step3Props.controller.feasibility ?? undefined,
    },
    plannerProps: {
      onRevealChange: i.sys.setMapRevealed,
      stepProps,
      liveReflection: i.tripContext.summary ? { summary: i.tripContext.summary, vehicle: i.tripContext.vehicle, settings: i.tripContext.settings } : null,
      routeStrategyProps: {
        strategies: i.calculation.routeStrategies,
        activeIndex: i.calculation.activeStrategyIndex,
        onSelect: i.calculation.selectStrategy,
        units: i.tripContext.settings.units,
        isRoundTrip: i.tripContext.settings.isRoundTrip,
      },
      tripSummaryProps: {
        summary: i.tripContext.summary!,
        settings: i.tripContext.settings,
        tripActive: i.tripMode.tripActive,
        onStop: () => i.tripMode.setTripActive(false),
        onOpenVehicleTab: () => i.wizard.goToStep(2),
      },
    },
    templatePreviewProps: { pendingTemplate: i.tripLoader.pendingTemplate },
    journalAtAGlanceProps: {
      summary: i.tripContext.summary!,
      settings: i.tripContext.settings,
      activeJournal: i.journal.activeJournal,
      ghostCar: i.features.ghostCar,
      onUpdateJournal: i.journal.updateActiveJournal,
    },
    postTripProps: i.journal.activeJournal?.finalized && i.tripContext.summary ? {
      journal: i.journal.activeJournal,
      summary: i.tripContext.summary,
      settings: i.tripContext.settings,
    } : null,
    landingProps: {
      onSelectMode: i.features.icebreaker.handleLandingSelect,
      hasSavedTrip: i.session.history.length > 0,
      onContinueSavedTrip: () => i.tripLoader.setTripMode('plan'),
      hasActiveSession: i.session.hasActiveSession,
      onResumeSession: i.session.handleResumeSession,
      lastDestination: i.session.lastDestination,
    },
  });

  // ── Share screen props ────────────────────────────────────────────────
  // Depends on stepProps (from planner wiring) — must stay in the orchestrator.
  const shareScreenProps: Omit<ComponentProps<typeof MakeMEETimeScreen>, 'onClose'> | null =
    stepProps.step3Props.controller.commit?.printInput ? {
      printInput: stepProps.step3Props.controller.commit.printInput,
      journal: i.journal.activeJournal,
      tripOrigin: i.tripLoader.tripOrigin,
    } : null;

  return {
    board,
    mapProps,
    adventureModeProps,
    plannerContextValue,
    shareScreenProps,
    flyoverActive: i.voila.flyoverActive,
    handleFlyoverComplete: i.voila.handleFlyoverComplete,
  };
}

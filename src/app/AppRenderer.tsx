/**
 * AppRenderer.tsx — MEE UI renderer.
 *
 * Takes board output and mounts surfaces and overlays.
 * Contains zero policy logic — that lives in useAppBoard + app-screen-policy.
 *
 * If you find yourself writing "if X but not Y" here, it belongs in the board.
 * If you find yourself writing callback wiring here, it belongs in useAppBoard.
 *
 * 💚 My Experience Engine — Renderer
 */

import type { ComponentProps } from 'react';
import { LandingScreen } from '../components/Landing/LandingScreen';
import { PlannerFullscreenShell } from '../components/App/PlannerFullscreenShell';
import { VoilaScreen } from '../components/Voila/VoilaScreen';
import { YourMEETimePreview } from '../components/Trip/Sharing/YourMEETimePreview';
import { MakeMEETimeScreen } from '../components/Trip/Sharing/MakeMEETimeScreen';
import { IcebreakerOverlays } from '../components/Icebreaker/IcebreakerOverlays';
import { JournalAtAGlance } from '../components/Trip/Journal/JournalAtAGlance';
import { AdventureMode } from '../components/Trip/Adventure/AdventureMode';
import { RouteStrategyPicker } from '../components/Trip/RouteStrategyPicker';
import { TripSummaryCard } from '../components/Trip/TripSummary';
import { PlannerProvider, type PlannerContextType } from '../contexts';
import type { AppBoard } from './useAppBoard';

interface AppRendererProps {
  board: AppBoard;
  mapRevealed: boolean;
  adventureModeProps: ComponentProps<typeof AdventureMode>;
  plannerContextValue: PlannerContextType;
  shareScreenProps: Omit<ComponentProps<typeof MakeMEETimeScreen>, 'onClose'> | null;
}

export function AppRenderer({
  board,
  mapRevealed,
  adventureModeProps,
  plannerContextValue,
  shareScreenProps,
}: AppRendererProps) {
  const { routeStrategyProps, tripSummaryProps, ...shellProps } = board.plannerProps;

  return (
    <>
      {/* Icebreaker overlays — always mounted (current App.tsx behavior) */}
      <IcebreakerOverlays {...board.icebreakerOverlayProps} />

      {/* Main surface — one at a time */}
      {board.activeSurface === 'voila' && (
        <VoilaScreen
          {...board.voilaProps}
          onEditTrip={board.commands.editVoila}
          onLockIn={board.commands.lockInVoila}
          onShare={board.commands.openShareScreen}
          onViewFullDetails={board.commands.viewFullDetails}
        />
      )}

      {board.activeSurface === 'templatePreview' && board.pendingTemplate && (
        <YourMEETimePreview
          template={board.pendingTemplate}
          onBuild={board.commands.buildFromTemplate}
          onOpenInPlanner={board.commands.openPlannerFromTemplate}
          onDismiss={board.commands.dismissTemplatePreview}
        />
      )}

      {board.activeSurface === 'journalAtAGlance' && board.journalAtAGlanceProps.activeJournal && (
        <JournalAtAGlance
          summary={board.journalAtAGlanceProps.summary}
          settings={board.journalAtAGlanceProps.settings}
          activeJournal={board.journalAtAGlanceProps.activeJournal}
          ghostCar={board.journalAtAGlanceProps.ghostCar}
          onUpdateJournal={board.journalAtAGlanceProps.onUpdateJournal}
          onViewFullDetails={board.commands.viewFullDetails}
        />
      )}

      {board.activeSurface === 'landing' && (
        <LandingScreen {...board.landingProps} />
      )}

      {/* Z2: Shell mounts for planning AND journalAtAGlance (ghost car state) */}
      {board.uiFlags.shouldMountPlannerShell && (
        <PlannerProvider value={plannerContextValue}>
          {board.uiFlags.shouldDimBackground && (
            <div
              className="absolute inset-0 pointer-events-none z-[1]"
              style={{ background: 'rgba(14, 11, 7, 0.72)' }}
            />
          )}

          <PlannerFullscreenShell {...shellProps} />

          {board.uiFlags.shouldShowRouteStrategy && (
            <div className="hidden md:flex absolute top-4 left-0 right-0 z-20 justify-center pointer-events-none px-4">
              <RouteStrategyPicker {...routeStrategyProps} />
            </div>
          )}

          {board.uiFlags.shouldShowTripSummaryCard && (
            <div className={`absolute z-20 pointer-events-none bottom-4 left-14 right-2 md:bottom-6 md:right-6 md:left-auto md:w-[380px] ${mapRevealed ? 'flex' : 'hidden md:flex'}`}>
              <div className="pointer-events-auto w-full">
                <TripSummaryCard {...tripSummaryProps} />
              </div>
            </div>
          )}

          {board.overlayState.adventureMode && (
            <AdventureMode {...adventureModeProps} />
          )}
        </PlannerProvider>
      )}

      {/* Secondary overlays — can sit on top of any surface */}
      {board.overlayState.shareScreen && shareScreenProps && (
        <MakeMEETimeScreen
          {...shareScreenProps}
          onClose={board.commands.closeShareScreen}
        />
      )}
    </>
  );
}

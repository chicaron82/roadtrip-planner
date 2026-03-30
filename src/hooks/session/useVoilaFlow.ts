import type React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
// useRef used for lockInPendingRef (voila curtain pattern)
import type { TripMode } from '../../types';
import { loadActiveSession, loadSessionPhase, saveSessionPhase } from '../../lib/storage';

interface UseVoilaFlowOptions {
  icebreakerOrigin?: boolean | null;
  isCalculating: boolean;
  setTripMode: (mode: TripMode | null) => void;
  setViewMode: (mode: 'plan' | 'journal') => void;
  goToStep: (step: 1 | 2 | 3) => void;
  forceStep: (step: 1 | 2 | 3) => void;
  setTripConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useVoilaFlow({
  icebreakerOrigin,
  isCalculating,
  setTripMode,
  setViewMode,
  goToStep,
  forceStep,
  setTripConfirmed,
}: UseVoilaFlowOptions) {
  const [showVoila, setShowVoila] = useState(
    () => loadSessionPhase() === 'voila' && loadActiveSession() !== null,
  );
  const [flyoverActive, setFlyoverActive] = useState(false);

  // Persist phase so HMR / page reload restores the correct screen.
  useEffect(() => {
    saveSessionPhase(showVoila ? 'voila' : 'default');
  }, [showVoila]);
  const [showShareScreen, setShowShareScreen] = useState(false);
  const handleOpenShareScreen  = useCallback(() => setShowShareScreen(true), []);
  const handleCloseShareScreen = useCallback(() => setShowShareScreen(false), []);

  const triggerFlyover = useCallback(() => setFlyoverActive(true), []);



  const handleShowVoila = useCallback(() => setShowVoila(true), []);

  const handleFlyoverComplete = useCallback(() => {
    setFlyoverActive(false);
    setShowVoila(true);
  }, []);

  const handleVoilaEdit = useCallback(() => {
    setShowVoila(false);
    setTripConfirmed(false);
    // Reset viewMode to 'plan' so a stale activeJournal from a prior run doesn't
    // immediately trigger showJournalAtAGlance when the user locks in again.
    setViewMode('plan');
    if (icebreakerOrigin) setTripMode('plan');
    goToStep(2);
  }, [icebreakerOrigin, setTripMode, setTripConfirmed, setViewMode, goToStep]);

  const handleGoHome = useCallback(() => {
    if (isCalculating) return;
    setTripMode(null);
    setShowVoila(false);
  }, [isCalculating, setTripMode]);

  const lockInPendingRef = useRef(false);

  const handleVoilaLockIn = useCallback(() => {
    setTripConfirmed(true);
    // Don't dismiss voila yet — keep it visible as a curtain while the journal
    // creates asynchronously. The auto-dismiss effect below hides voila once
    // activeJournal arrives, preventing a flash of the Step 3 planner.
    lockInPendingRef.current = true;
    // Both paths: forceStep(3) ensures the confirmed trip state renders correctly.
    // Classic path: markStepComplete advances completedSteps but NOT planningStep,
    // so planningStep is still 2 (the last step the user was on). Without this,
    // closing Voilà renders PlannerFullscreenShell at step 2.
    // Icebreaker path: planningStep is still 1 (wizard was bypassed entirely).
    forceStep(3);
    if (icebreakerOrigin) setTripMode('plan');
  }, [icebreakerOrigin, forceStep, setTripMode, setTripConfirmed]);

  // Called after startJournal completes (success or failure) to drop the
  // voila curtain. Gated by the ref so it's a no-op outside the lock-in flow.
  const dismissVoilaCurtain = useCallback(() => {
    if (lockInPendingRef.current) {
      lockInPendingRef.current = false;
      setShowVoila(false);
    }
  }, []);

  const handleViewFullDetails = useCallback(() => {
    setShowVoila(false);
    forceStep(3);
    // Icebreaker path: tripMode is still null until lock-in. Set it so the
    // planning surface renders instead of falling through to landing.
    if (icebreakerOrigin) setTripMode('plan');
  }, [forceStep, icebreakerOrigin, setTripMode]);

  /** Minimize journal back to voila screen. */
  const handleMinimizeToVoila = useCallback(() => {
    setShowVoila(true);
  }, []);

  /** Return from voila to journal. */
  const handleReturnToJournal = useCallback(() => {
    // Explicitly restore journal viewMode — it may have been changed to 'plan'
    // if the user navigated away (e.g. Full details → back to voila). Without
    // this, showJournalAtAGlance stays false and the surface falls to planning.
    setViewMode('journal');
    setShowVoila(false);
  }, [setViewMode]);

  return {
    showVoila,
    flyoverActive,
    showShareScreen,
    triggerFlyover,
    handleShowVoila,
    handleFlyoverComplete,
    handleVoilaEdit,
    handleVoilaLockIn,
    handleViewFullDetails,
    handleGoHome,
    handleMinimizeToVoila,
    handleReturnToJournal,
    dismissVoilaCurtain,
    handleOpenShareScreen,
    handleCloseShareScreen,
  };
}

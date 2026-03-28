import type React from 'react';
import { useState, useCallback, useEffect } from 'react';
import type { TripMode } from '../../types';
import { loadActiveSession, loadSessionPhase, saveSessionPhase } from '../../lib/storage';

interface UseVoilaFlowOptions {
  icebreakerOrigin?: boolean | null;
  isCalculating: boolean;
  setTripMode: (mode: TripMode | null) => void;
  goToStep: (step: 1 | 2 | 3) => void;
  forceStep: (step: 1 | 2 | 3) => void;
  setTripConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useVoilaFlow({
  icebreakerOrigin,
  isCalculating,
  setTripMode,
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
    if (icebreakerOrigin) setTripMode('plan');
    goToStep(2);
  }, [icebreakerOrigin, setTripMode, setTripConfirmed, goToStep]);

  const handleGoHome = useCallback(() => {
    if (isCalculating) return;
    setTripMode(null);
    setShowVoila(false);
  }, [isCalculating, setTripMode]);

  const handleVoilaLockIn = useCallback(() => {
    setTripConfirmed(true);
    setShowVoila(false);
    // Both paths: forceStep(3) ensures the confirmed trip state renders correctly.
    // Classic path: markStepComplete advances completedSteps but NOT planningStep,
    // so planningStep is still 2 (the last step the user was on). Without this,
    // closing Voilà renders PlannerFullscreenShell at step 2.
    // Icebreaker path: planningStep is still 1 (wizard was bypassed entirely).
    forceStep(3);
    if (icebreakerOrigin) setTripMode('plan');
  }, [icebreakerOrigin, forceStep, setTripMode, setTripConfirmed]);

  const handleViewFullDetails = useCallback(() => {
    setShowVoila(false);
    forceStep(3);
  }, [forceStep]);

  /** Minimize journal back to voila screen. */
  const handleMinimizeToVoila = useCallback(() => {
    setShowVoila(true);
  }, []);

  /** Return from voila to journal. */
  const handleReturnToJournal = useCallback(() => {
    setShowVoila(false);
  }, []);

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
    handleOpenShareScreen,
    handleCloseShareScreen,
  };
}

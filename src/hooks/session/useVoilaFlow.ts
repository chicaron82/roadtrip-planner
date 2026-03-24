import type React from 'react';
import { useState, useCallback } from 'react';
import type { TripMode } from '../../types';

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
  const [showVoila, setShowVoila] = useState(false);
  const [flyoverActive, setFlyoverActive] = useState(false);
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
    handleOpenShareScreen,
    handleCloseShareScreen,
  };
}

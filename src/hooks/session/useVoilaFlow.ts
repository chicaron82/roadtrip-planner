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
    if (icebreakerOrigin) setTripMode('plan');
    forceStep(3);
  }, [icebreakerOrigin, setTripMode, forceStep, setTripConfirmed]);

  return {
    showVoila,
    flyoverActive,
    triggerFlyover,
    handleShowVoila,
    handleFlyoverComplete,
    handleVoilaEdit,
    handleVoilaLockIn,
    handleGoHome,
  };
}

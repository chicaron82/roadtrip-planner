import type React from 'react';
import { DEFAULT_LOCATIONS } from '../contexts';
import type { Location, TripChallenge, TripMode, TripOrigin } from '../types';

type SetLocations = React.Dispatch<React.SetStateAction<Location[]>>;

interface ResetTripSessionParams {
  setLocations: SetLocations;
  clearTripCalculation: () => void;
  resetPOIs: () => void;
  clearStops: () => void;
  resetWizard: () => void;
  setActiveChallenge: (challenge: TripChallenge | null) => void;
  setTripOrigin: (origin: TripOrigin | null) => void;
  setTripConfirmed: (value: boolean) => void;
}

interface SelectTripModeParams {
  mode: TripMode;
  resetTripSession: () => void;
  clearSharedUrlState: () => void;
  setTripMode: (mode: TripMode | null) => void;
  setShowAdventureMode: (value: boolean) => void;
  applyLastOrigin: () => void;
}

export function resetTripPlanningInputs(setLocations: SetLocations): void {
  setLocations(DEFAULT_LOCATIONS);
}

export function resetTripSession({
  setLocations,
  clearTripCalculation,
  resetPOIs,
  clearStops,
  resetWizard,
  setActiveChallenge,
  setTripOrigin,
  setTripConfirmed,
}: ResetTripSessionParams): void {
  resetTripPlanningInputs(setLocations);
  clearTripCalculation();
  resetPOIs();
  clearStops();
  resetWizard();
  setActiveChallenge(null);
  setTripOrigin(null);
  setTripConfirmed(false);
}

export function resetAppAndSelectTripMode({
  mode,
  resetTripSession,
  clearSharedUrlState,
  setTripMode,
  setShowAdventureMode,
  applyLastOrigin,
}: SelectTripModeParams): void {
  resetTripSession();
  clearSharedUrlState();
  setTripMode(mode);
  setShowAdventureMode(mode === 'adventure');
  applyLastOrigin();
}
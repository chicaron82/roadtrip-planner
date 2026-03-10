import type React from 'react';
import type { Location, TripSettings, Vehicle } from '../types';

export interface ParsedTripURLState {
  locations?: Location[];
  vehicle?: Vehicle;
  settings?: TripSettings;
}

interface BootFromURLStateParams {
  parsedState: ParsedTripURLState | null;
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: (vehicle: Vehicle) => void;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  markStepComplete: (step: number) => void;
  forceStep: (step: 1 | 2 | 3) => void;
}

export function bootTripInputsFromURLState({
  parsedState,
  setLocations,
  setVehicle,
  setSettings,
  markStepComplete,
  forceStep,
}: BootFromURLStateParams): boolean {
  if (!parsedState) return false;

  if (parsedState.locations) setLocations(parsedState.locations);
  if (parsedState.vehicle) setVehicle(parsedState.vehicle);
  if (parsedState.settings) setSettings(parsedState.settings);

  const locs = parsedState.locations;
  const hasCalculableRoute =
    !!locs &&
    locs.length >= 2 &&
    locs[0].lat !== 0 &&
    locs[0].lng !== 0 &&
    locs[locs.length - 1].lat !== 0 &&
    locs[locs.length - 1].lng !== 0;

  if (hasCalculableRoute) {
    markStepComplete(1);
    markStepComplete(2);
    markStepComplete(3);
    forceStep(3);
  }

  return true;
}

export function applyLastOriginToTripInputs(
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>,
  lastOrigin: Location | null,
): void {
  if (!lastOrigin) return;
  setLocations(prev =>
    prev.map((loc, index) => (index === 0 ? { ...lastOrigin, id: loc.id, type: 'origin' } : loc)),
  );
}

export function applyAdaptiveCostDefaults(
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>,
  defaults: { hotelPricePerNight: number; mealPricePerDay: number } | null,
): void {
  if (!defaults) return;
  setSettings(prev => ({
    ...prev,
    hotelPricePerNight: defaults.hotelPricePerNight,
    mealPricePerDay: defaults.mealPricePerDay,
  }));
}
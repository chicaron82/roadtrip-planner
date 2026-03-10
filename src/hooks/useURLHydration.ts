import { useEffect } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary } from '../types';
import { parseStateFromURL } from '../lib/url';
import { saveLastOrigin, getLastOrigin } from '../lib/storage';
import { getAdaptiveDefaults } from '../lib/user-profile';
import { parsePresetFromURL } from '../lib/style-presets';
import { applyAdaptiveCostDefaults, applyLastOriginToTripInputs, bootTripInputsFromURLState } from '../lib/boot-sequence';
import type { AdaptiveDefaults } from '../lib/user-profile';
import type { PlanningStep } from './useWizard';

interface UseURLHydrationOptions {
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: (vehicle: Vehicle) => void;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  locations: Location[];
  settings: TripSettings;
  summary: TripSummary | null;
  markStepComplete: (step: number) => void;
  forceStep: (step: PlanningStep) => void;
  setAdaptiveDefaults: (defaults: AdaptiveDefaults | null) => void;
}

export function useURLHydration({
  setLocations,
  setVehicle,
  setSettings,
  locations,
  settings,
  summary,
  markStepComplete,
  forceStep,
  setAdaptiveDefaults,
}: UseURLHydrationOptions): void {

  // Load state from URL on mount — or pre-fill last-used origin for return users
  useEffect(() => {
    const urlBooted = bootTripInputsFromURLState({
      parsedState: parseStateFromURL(),
      setLocations,
      setVehicle,
      setSettings,
      markStepComplete,
      forceStep,
    });

    if (!urlBooted) {
      applyLastOriginToTripInputs(setLocations, getLastOrigin());

      const defaults = getAdaptiveDefaults();
      if (defaults) {
        setAdaptiveDefaults(defaults);
        if (!parsePresetFromURL()) {
          applyAdaptiveCostDefaults(setSettings, defaults);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist origin whenever user sets a valid one
  useEffect(() => {
    const origin = locations[0];
    if (origin?.lat && origin.lat !== 0 && origin.name) {
      saveLastOrigin(origin);
    }
  }, [locations]);

  // Recalculate departure time when using "Arrive By"
  useEffect(() => {
    if (settings.useArrivalTime && settings.arrivalDate && settings.arrivalTime && summary) {
      const arrivalDateTime = new Date(`${settings.arrivalDate}T${settings.arrivalTime}`);
      const departureDateTime = new Date(
        arrivalDateTime.getTime() - summary.totalDurationMinutes * 60 * 1000
      );
      const newDepDate = departureDateTime.toISOString().split('T')[0];
      const newDepTime = departureDateTime.toTimeString().slice(0, 5);
      
      if (newDepDate !== settings.departureDate || newDepTime !== settings.departureTime) {
        setSettings(prev => ({ ...prev, departureDate: newDepDate, departureTime: newDepTime }));
      }
    }
  }, [
    settings.useArrivalTime,
    settings.arrivalDate,
    settings.arrivalTime,
    summary,
    settings.departureDate,
    settings.departureTime,
    setSettings,
  ]);
}

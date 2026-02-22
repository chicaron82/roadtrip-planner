import { useState, useCallback } from 'react';
import type { Location, Vehicle, TripSettings, TripChallenge, TripOrigin } from '../types';
import { buildAdventureBudget } from '../lib/adventure-service';
import type { AdventureSelection } from '../components/Trip/AdventureMode';
import type { TemplateImportResult } from '../lib/url';
import type { PlanningStep } from './useWizard';

interface UseTripLoaderOptions {
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: (vehicle: Vehicle) => void;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  markStepComplete: (step: number) => void;
  forceStep: (step: PlanningStep) => void;
  goToStep: (step: PlanningStep) => void;
  onAdventureComplete?: () => void;
}

interface UseTripLoaderReturn {
  activeChallenge: TripChallenge | null;
  tripOrigin: TripOrigin | null;
  setActiveChallenge: (challenge: TripChallenge | null) => void;
  setTripOrigin: (origin: TripOrigin | null) => void;
  handleImportTemplate: (result: TemplateImportResult) => void;
  handleSelectChallenge: (challenge: TripChallenge) => void;
  handleAdventureSelect: (selection: AdventureSelection) => void;
}

export function useTripLoader({
  setLocations,
  setVehicle,
  setSettings,
  markStepComplete,
  forceStep,
  goToStep,
  onAdventureComplete,
}: UseTripLoaderOptions): UseTripLoaderReturn {
  const [activeChallenge, setActiveChallenge] = useState<TripChallenge | null>(null);
  const [tripOrigin, setTripOrigin] = useState<TripOrigin | null>(null);

  const handleImportTemplate = useCallback((result: TemplateImportResult) => {
    if (result.locations.length > 0) setLocations(result.locations);
    if (result.vehicle) setVehicle(result.vehicle);
    if (result.settings) setSettings(prev => ({ ...prev, ...result.settings }));
    setActiveChallenge(null);
    setTripOrigin({
      type: 'template',
      title: result.meta.title,
      author: result.meta.author,
    });
    markStepComplete(1);
    if (result.vehicle) {
      markStepComplete(2);
      forceStep(2);
    }
  }, [setLocations, setVehicle, setSettings, markStepComplete, forceStep]);

  const handleSelectChallenge = useCallback((challenge: TripChallenge) => {
    if (challenge.locations.length > 0) setLocations(challenge.locations);
    if (challenge.vehicle) setVehicle(challenge.vehicle);
    if (challenge.settings) setSettings(prev => ({ ...prev, ...challenge.settings }));
    setActiveChallenge(challenge);
    setTripOrigin({ type: 'challenge', id: challenge.id, title: challenge.title });
    markStepComplete(1);
    if (challenge.vehicle) {
      markStepComplete(2);
      forceStep(2);
    }
  }, [setLocations, setVehicle, setSettings, markStepComplete, forceStep]);

  const handleAdventureSelect = useCallback((selection: AdventureSelection) => {
    setLocations(prev => prev.map(loc =>
      loc.type === 'destination'
        ? { ...loc, ...selection.destination, type: 'destination' as const }
        : loc
    ));

    const adventureBudget = buildAdventureBudget(
      selection.budget,
      selection.estimatedDistanceKm,
      selection.preferences,
      selection.accommodationType,
    );

    setSettings(prev => ({
      ...prev,
      numTravelers: selection.travelers,
      numDrivers: Math.min(selection.travelers, prev.numDrivers),
      isRoundTrip: selection.isRoundTrip,
      tripPreferences: selection.preferences,
      departureDate: selection.departureDate,
      departureTime: selection.departureTime,
      budget: {
        ...prev.budget,
        profile: adventureBudget.profile,
        weights: adventureBudget.weights,
        allocation: 'fixed' as const,
        total: adventureBudget.total,
        gas: adventureBudget.gas,
        hotel: adventureBudget.hotel,
        food: adventureBudget.food,
        misc: adventureBudget.misc,
      },
    }));

    markStepComplete(1);
    goToStep(2);
    onAdventureComplete?.();
  }, [setLocations, setSettings, markStepComplete, goToStep, onAdventureComplete]);

  return {
    activeChallenge,
    tripOrigin,
    setActiveChallenge,
    setTripOrigin,
    handleImportTemplate,
    handleSelectChallenge,
    handleAdventureSelect,
  };
}

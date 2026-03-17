import { useState, useCallback } from 'react';
import type { Location, Vehicle, TripSettings, TripChallenge, TripOrigin, TripMode, HotelTier } from '../types';
import { buildAdventureBudget } from '../lib/adventure/adventure-service';
import type { AdventureSelection } from '../components/Trip/Adventure/AdventureMode';
import type { TemplateImportResult } from '../lib/url';
import type { PlanningStep } from './useWizard';
import { formatLocalYMD } from '../lib/utils';

/** Estimate one-way driving days given a distance and max daily drive hours. */
function estimateDrivingDays(distanceKm: number, maxDriveHoursPerDay: number): number {
  const avgSpeedKmh = 90;
  const totalDriveHours = distanceKm / avgSpeedKmh;
  return Math.max(1, Math.ceil(totalDriveHours / maxDriveHoursPerDay));
}

/** Maps Adventure Mode's accommodation tier to Plan Mode hotel settings. */
const ACCOMMODATION_TO_HOTEL: Record<'budget' | 'moderate' | 'comfort', { tier: HotelTier; pricePerNight: number }> = {
  budget:   { tier: 'budget',  pricePerNight: 90  },
  moderate: { tier: 'regular', pricePerNight: 140 },
  comfort:  { tier: 'premium', pricePerNight: 220 },
};

interface UseTripLoaderOptions {
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: (vehicle: Vehicle) => void;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  setTripMode: (mode: TripMode) => void;
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
  setTripMode,
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
      id: result.meta.templateId,
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

    setSettings(prev => {
      // Calculate returnDate so the planner generates destination stay days to match
      // the N-day budget Adventure Mode promised. Formula:
      //   one-way driving days = ceil(distanceKm / (90 km/h × maxDriveHours))
      //   stay days = max(0, totalDays - 2 × drivingDays)  [for round trip]
      //   returnDate = departureDate + drivingDays + stayDays
      const maxDriveHours = prev.maxDriveHours ?? 10;
      const oneWayDistanceKm = selection.isRoundTrip
        ? selection.estimatedDistanceKm / 2
        : selection.estimatedDistanceKm;
      const drivingDaysOneWay = estimateDrivingDays(oneWayDistanceKm, maxDriveHours);
      const stayDays = selection.isRoundTrip
        ? Math.max(0, selection.days - 2 * drivingDaysOneWay)
        : 0;
      const departure = new Date(selection.departureDate + 'T00:00:00');
      const returnDay = new Date(departure);
      returnDay.setDate(returnDay.getDate() + drivingDaysOneWay + stayDays);
      const returnDate = selection.isRoundTrip ? formatLocalYMD(returnDay) : '';

      // Map Adventure accommodation tier → Plan Mode hotel settings
      const hotel = ACCOMMODATION_TO_HOTEL[selection.accommodationType ?? 'moderate'];

      return {
      ...prev,
      numTravelers: selection.travelers,
      numDrivers: selection.travelers, // Adventure Mode has no separate drivers input — all travelers drive
      isRoundTrip: selection.isRoundTrip,
      tripPreferences: selection.preferences,
      departureDate: selection.departureDate,
      departureTime: selection.departureTime,
      returnDate,
      hotelTier: hotel.tier,
      hotelPricePerNight: hotel.pricePerNight,
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
      };
    });

    // Switch to Plan Mode — "the conversation continues"
    setTripMode('plan');
    markStepComplete(1);
    goToStep(2);
    onAdventureComplete?.();
  }, [setLocations, setSettings, setTripMode, markStepComplete, goToStep, onAdventureComplete]);

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

import { useState, useCallback } from 'react';
import type { Location, Vehicle, TripSettings, TripChallenge, TripOrigin, TripMode, HotelTier } from '../../types';
import { buildAdventureBudget } from '../../lib/adventure/adventure-service';
import type { AdventureSelection } from '../../components/Trip/Adventure/AdventureMode';
import type { TemplateImportResult } from '../../lib/url';
import type { PlanningStep } from '../wizard/useWizard';
import { formatLocalYMD } from '../../lib/utils';

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

/**
 * Normalises a potentially stale template departure date to today or tomorrow.
 * - Future dates are kept as-is (user may have planned ahead).
 * - Past/today dates: if we're still within 2h of the original departure time,
 *   use today; otherwise shift to tomorrow. No departure time → use today unless
 *   it's past 20:00, in which case shift to tomorrow.
 */
function normalizeDepartureDate(templateDate: string | undefined, departureTime: string | undefined): string {
  const today = new Date();
  const todayStr = formatLocalYMD(today);
  if (!templateDate || templateDate > todayStr) return templateDate ?? todayStr;

  if (departureTime) {
    const [h, m] = departureTime.split(':').map(Number);
    const departureToday = new Date(today);
    departureToday.setHours(h, m, 0, 0);
    // Within 2h after the scheduled departure — still plausible to leave today
    const cutoff = new Date(departureToday.getTime() + 2 * 60 * 60 * 1000);
    if (today <= cutoff) return todayStr;
  } else {
    if (today.getHours() < 20) return todayStr;
  }

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatLocalYMD(tomorrow);
}

interface UseTripLoaderOptions {
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  setVehicle: (vehicle: Vehicle) => void;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  setTripMode: (mode: TripMode) => void;
  markStepComplete: (step: number) => void;
  forceStep: (step: PlanningStep) => void;
  goToStep: (step: PlanningStep) => void;
  onAdventureComplete?: () => void;
  /** Wipe the active journal when a template or challenge is loaded, so the
   *  fresh route gets a fresh journal (not the previous trip's). */
  clearJournal?: () => void;
}

interface UseTripLoaderReturn {
  activeChallenge: TripChallenge | null;
  tripOrigin: TripOrigin | null;
  templateRecommendations: TemplateImportResult['meta']['recommendations'];
  /** Template loaded from file but not yet applied — waiting for preview screen. */
  pendingTemplate: TemplateImportResult | null;
  setActiveChallenge: (challenge: TripChallenge | null) => void;
  setTripOrigin: (origin: TripOrigin | null) => void;
  handleImportTemplate: (result: TemplateImportResult) => void;
  /** Sets pendingTemplate — routes file loads through the preview screen. */
  handleTemplateLoaded: (result: TemplateImportResult) => void;
  /** Clears pendingTemplate without applying — user dismissed the preview. */
  handleDismissPendingTemplate: () => void;
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
  clearJournal,
}: UseTripLoaderOptions): UseTripLoaderReturn {
  const [activeChallenge, setActiveChallenge] = useState<TripChallenge | null>(null);
  const [tripOrigin, setTripOrigin] = useState<TripOrigin | null>(null);
  const [templateRecommendations, setTemplateRecommendations] = useState<TemplateImportResult['meta']['recommendations']>(undefined);
  const [pendingTemplate, setPendingTemplate] = useState<TemplateImportResult | null>(null);

  const handleTemplateLoaded = useCallback((result: TemplateImportResult) => {
    setPendingTemplate(result);
  }, []);

  const handleDismissPendingTemplate = useCallback(() => {
    setPendingTemplate(null);
  }, []);

  const handleImportTemplate = useCallback((result: TemplateImportResult) => {
    clearJournal?.();
    if (result.locations.length > 0) setLocations(result.locations);
    if (result.vehicle) setVehicle(result.vehicle);
    if (result.settings) {
      const normalizedDate = normalizeDepartureDate(result.settings.departureDate, result.settings.departureTime);
      setSettings(prev => ({ ...prev, ...result.settings, departureDate: normalizedDate }));
    }
    setActiveChallenge(null);
    setTemplateRecommendations(result.meta.recommendations);
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
  }, [clearJournal, setLocations, setVehicle, setSettings, markStepComplete, forceStep]);

  const handleSelectChallenge = useCallback((challenge: TripChallenge) => {
    clearJournal?.();
    if (challenge.locations.length > 0) setLocations(challenge.locations);
    if (challenge.vehicle) setVehicle(challenge.vehicle);
    if (challenge.settings) {
      const normalizedDate = normalizeDepartureDate(challenge.settings.departureDate, challenge.settings.departureTime);
      setSettings(prev => ({ ...prev, ...challenge.settings, departureDate: normalizedDate }));
    }
    setActiveChallenge(challenge);
    setTripOrigin({ type: 'challenge', id: challenge.id, title: challenge.title });
    markStepComplete(1);
    if (challenge.vehicle) {
      markStepComplete(2);
      forceStep(2);
    }
  }, [clearJournal, setLocations, setVehicle, setSettings, markStepComplete, forceStep]);

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

    // Switch to Plan Mode — land at Step 1 so user sees destination confirmed.
    // markStepComplete(1) fires naturally when user taps NEXT from Step 1.
    setTripMode('plan');
    goToStep(1);
    onAdventureComplete?.();
  }, [setLocations, setSettings, setTripMode, goToStep, onAdventureComplete]);

  return {
    activeChallenge,
    tripOrigin,
    templateRecommendations,
    pendingTemplate,
    setActiveChallenge,
    setTripOrigin,
    handleImportTemplate,
    handleTemplateLoaded,
    handleDismissPendingTemplate,
    handleSelectChallenge,
    handleAdventureSelect,
  };
}

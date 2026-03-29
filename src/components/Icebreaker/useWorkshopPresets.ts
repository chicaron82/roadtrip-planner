/**
 * useWorkshopPresets — Beat 3 state logic extracted from WorkshopPanel.
 *
 * Owns: vehicle/hotel/pace/budget selection state, live estimate memos, commit handler.
 * Also exports the preset data tables so WorkshopPanel can render them without re-declaring.
 *
 * 💚 My Experience Engine — Beat 3 of the Four-Beat Arc
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Vehicle, TripSettings } from '../../types';
import { generateEstimate } from '../../lib/estimate-service';
import { formatHoursFromMinutes } from '../../lib/utils';

// ── Preset data tables (exported for WorkshopPanel rendering) ─────────────────

export type VehicleType = 'sedan' | 'suv' | 'truck' | 'van' | 'hybrid';

export const VEHICLE_TYPES: { type: VehicleType; emoji: string; label: string; vehicle: Vehicle }[] = [
  { type: 'sedan', emoji: '🚗', label: 'Sedan', vehicle: { year: '2024', make: 'Toyota', model: 'Camry', fuelEconomyCity: 8.2, fuelEconomyHwy: 6.0, tankSize: 60 } },
  { type: 'suv', emoji: '🚙', label: 'SUV', vehicle: { year: '2024', make: 'Toyota', model: 'RAV4', fuelEconomyCity: 9.4, fuelEconomyHwy: 7.2, tankSize: 55 } },
  { type: 'truck', emoji: '🛻', label: 'Truck', vehicle: { year: '2024', make: 'Ford', model: 'F-150', fuelEconomyCity: 13.5, fuelEconomyHwy: 10.2, tankSize: 87 } },
  { type: 'van', emoji: '🚐', label: 'Van', vehicle: { year: '2024', make: 'Chrysler', model: 'Pacifica', fuelEconomyCity: 10.8, fuelEconomyHwy: 8.0, tankSize: 68 } },
  { type: 'hybrid', emoji: '⚡', label: 'Hybrid', vehicle: { year: '2024', make: 'Toyota', model: 'Prius', fuelEconomyCity: 4.3, fuelEconomyHwy: 4.0, tankSize: 43 } },
];

export type HotelTier = 'budget' | 'regular' | 'premium';

export const HOTEL_OPTIONS: { tier: HotelTier; emoji: string; label: string; price: number }[] = [
  { tier: 'budget', emoji: '🏕', label: 'Budget', price: 90 },
  { tier: 'regular', emoji: '🏨', label: 'Regular', price: 140 },
  { tier: 'premium', emoji: '✨', label: 'Premium', price: 220 },
];

export type Pace = 'relaxed' | 'balanced' | 'push';

export const PACE_OPTIONS: { pace: Pace; emoji: string; label: string; hours: number }[] = [
  { pace: 'relaxed', emoji: '🐢', label: 'Relaxed', hours: 6 },
  { pace: 'balanced', emoji: '⚖️', label: 'Balanced', hours: 8 },
  { pace: 'push', emoji: '🚀', label: 'Push it', hours: 10 },
];

export const CATEGORY_COLORS = ['#ea580c', '#7c3aed', '#16a34a', '#0891b2'] as const;

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseWorkshopPresetsOptions {
  sketchDistanceKm: number;
  sketchDurationMinutes: number;
  /** Real driving-day count from the last completed calculation. Overrides the sketch estimate. */
  sketchDrivingDays?: number;
  vehicle: Vehicle;
  settings: TripSettings;
  onCommit: (overrides: { settings: Partial<TripSettings>; vehicle?: Vehicle }) => void;
  /** Called immediately when a route-affecting setting changes so the map rerenders live. */
  onSettingsLiveChange?: (overrides: Partial<TripSettings>) => void;
}

export interface WorkshopPresetsResult {
  travelers: number;
  setTravelers: (n: number) => void;
  numRooms: number;
  setNumRooms: (n: number) => void;
  isDayTrip: boolean;
  vehicleType: VehicleType;
  setVehicleType: (t: VehicleType) => void;
  hotelTier: HotelTier;
  setHotelTier: (h: HotelTier) => void;
  pace: Pace;
  setPace: (p: Pace) => void;
  avoidBorders: boolean;
  setAvoidBorders: (v: boolean) => void;
  showMore: boolean;
  setShowMore: (v: boolean) => void;
  budgetEnabled: boolean;
  setBudgetEnabled: (v: boolean) => void;
  budgetAmount: number;
  setBudgetAmount: (v: number) => void;
  estimate: ReturnType<typeof generateEstimate>;
  driveLabel: string;
  percents: number[];
  handleCommit: () => void;
}

export function useWorkshopPresets({
  sketchDistanceKm,
  sketchDurationMinutes,
  sketchDrivingDays,
  vehicle: initialVehicle,
  settings: initialSettings,
  onCommit,
  onSettingsLiveChange,
}: UseWorkshopPresetsOptions): WorkshopPresetsResult {
  const initialType = VEHICLE_TYPES.find(v =>
    v.vehicle.fuelEconomyHwy === initialVehicle.fuelEconomyHwy
  )?.type ?? 'sedan';

  const [travelers, setTravelers] = useState(initialSettings.numTravelers ?? 1);

  // Smart room default: 1 room for ≤4 travelers, 2 for 5+.
  // userSetRooms tracks whether the user has manually touched the stepper —
  // if so, auto-sync is suspended so their choice is preserved when travelers changes.
  const defaultRooms = (n: number) => Math.max(1, Math.ceil(n / 4));
  const [numRooms, setNumRoomsState] = useState(defaultRooms(initialSettings.numTravelers ?? 1));
  const [userSetRooms, setUserSetRooms] = useState(false);

  const setNumRooms = (n: number) => { setNumRoomsState(n); setUserSetRooms(true); };

  // Auto-sync rooms when travelers changes, unless the user has overridden.
  useEffect(() => {
    if (!userSetRooms) setNumRoomsState(defaultRooms(travelers));
  }, [travelers, userSetRooms]);

  const [vehicleType, setVehicleType] = useState<VehicleType>(initialType);
  const [hotelTier, setHotelTier] = useState<HotelTier>(
    (initialSettings.hotelTier as HotelTier) || 'regular'
  );
  const [pace, setPace] = useState<Pace>('balanced');
  const [avoidBorders, setAvoidBorders] = useState(initialSettings.avoidBorders ?? false);
  const [showMore, setShowMore] = useState(false);

  // Live-reroute when user toggles avoidBorders or changes pace — fires once per change.
  // Skip on mount (initial values don't need a recalc).
  const isFirstAvoidBordersRender = useRef(true);
  useEffect(() => {
    if (isFirstAvoidBordersRender.current) { isFirstAvoidBordersRender.current = false; return; }
    onSettingsLiveChange?.({ avoidBorders });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoidBorders]);

  const isFirstPaceRender = useRef(true);
  useEffect(() => {
    if (isFirstPaceRender.current) { isFirstPaceRender.current = false; return; }
    const selectedPaceForEffect = PACE_OPTIONS.find(p => p.pace === pace)!;
    onSettingsLiveChange?.({ maxDriveHours: selectedPaceForEffect.hours });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pace]);
  const [budgetEnabled, setBudgetEnabled] = useState(initialSettings.budgetMode === 'plan-to-budget');
  const [budgetAmount, setBudgetAmount] = useState(
    initialSettings.budget?.total ?? 2000
  );

  const selectedVehicle = VEHICLE_TYPES.find(v => v.type === vehicleType)!;
  const selectedHotel = HOTEL_OPTIONS.find(h => h.tier === hotelTier)!;
  const selectedPace = PACE_OPTIONS.find(p => p.pace === pace)!;

  // Day trip: trip fits in a single day of driving → 0 overnight stops needed.
  // Prefer the real drivingDays from a completed calculation (sketchDrivingDays) — it accounts
  // for actual segment boundaries that simple division misses. Fall back to math estimate.
  const sketchDays = sketchDrivingDays ?? Math.max(1, Math.ceil(sketchDurationMinutes / (selectedPace.hours * 60)));
  const isDayTrip = sketchDays === 1;

  const mergedSettings: TripSettings = useMemo(() => ({
    ...initialSettings,
    numTravelers: travelers,
    numRooms: isDayTrip ? 0 : numRooms,
    hotelTier,
    hotelPricePerNight: selectedHotel.price,
    maxDriveHours: selectedPace.hours,
    budgetMode: budgetEnabled ? 'plan-to-budget' as const : 'open' as const,
    budget: budgetEnabled
      ? { ...initialSettings.budget, total: budgetAmount }
      : initialSettings.budget,
    avoidBorders,
  }), [initialSettings, travelers, numRooms, isDayTrip, hotelTier, selectedHotel.price, selectedPace.hours, budgetEnabled, budgetAmount, avoidBorders]);

  const sketchSummary = useMemo(() => ({
    totalDistanceKm: sketchDistanceKm,
    totalDurationMinutes: sketchDurationMinutes,
    totalFuelLitres: 0,
    totalFuelCost: 0,
    gasStops: 0,
    costPerPerson: 0,
    drivingDays: sketchDays,
    segments: [],
    fullGeometry: [],
  }), [sketchDistanceKm, sketchDurationMinutes, sketchDays]);

  const estimate = useMemo(
    () => generateEstimate(sketchSummary, selectedVehicle.vehicle, mergedSettings, { raw: true }),
    [sketchSummary, selectedVehicle.vehicle, mergedSettings],
  );

  const driveLabel = formatHoursFromMinutes(Math.round(sketchDurationMinutes));
  const totals = [
    estimate.breakdown[0].mid, estimate.breakdown[1].mid,
    estimate.breakdown[2].mid, estimate.breakdown[3].mid,
  ];
  const total = totals.reduce((a, b) => a + b, 0);
  const percents = totals.map(v => total > 0 ? (v / total) * 100 : 25);

  const handleCommit = () => {
    onCommit({
      settings: {
        numTravelers: travelers,
        numRooms,
        hotelTier,
        hotelPricePerNight: selectedHotel.price,
        maxDriveHours: selectedPace.hours,
        budgetMode: budgetEnabled ? 'plan-to-budget' : 'open',
        budget: budgetEnabled ? { ...initialSettings.budget, total: budgetAmount } : initialSettings.budget,
        avoidBorders,
      },
      vehicle: selectedVehicle.vehicle,
    });
  };

  return {
    travelers, setTravelers,
    numRooms, setNumRooms,
    isDayTrip,
    vehicleType, setVehicleType,
    hotelTier, setHotelTier,
    pace, setPace,
    avoidBorders, setAvoidBorders,
    showMore, setShowMore,
    budgetEnabled, setBudgetEnabled,
    budgetAmount, setBudgetAmount,
    estimate, driveLabel, percents,
    handleCommit,
  };
}

/**
 * useAdventureModeController.ts — Adventure mode search state and logic.
 *
 * Extracts from AdventureMode:
 *  - localOrigin state + handleOriginChange
 *  - Trip configuration: budget, days, travelers, preferences, accommodationType,
 *    isRoundTrip, departureDate, departureTime
 *  - Debounced findAdventureDestinations effect → destinations, isCalculating, hasSearched
 *  - previewMaxKm — derived max distance based on current config
 *  - togglePreference — adds/removes TripPreference
 *  - handleSelectDestination — builds AdventureSelection and calls onSelectDestination + onClose
 *
 * AdventureMode becomes a layout-only component after this.
 *
 * 💚 My Experience Engine
 */

import { useState, useEffect } from 'react';
import type { Location, AdventureDestination, TripPreference } from '../types';
import { findAdventureDestinations, calculateMaxDistance } from '../lib/adventure/adventure-service';
import { formatLocalYMD } from '../lib/utils';
import type { AdventureSelection } from '../components/Trip/Adventure/AdventureMode';

interface UseAdventureModeControllerOptions {
  initialOrigin: Location | null;
  onOriginChange?: (origin: Location) => void;
  onSelectDestination: (selection: AdventureSelection) => void;
  onClose: () => void;
  fuelCostPerKm?: number;
}

export interface UseAdventureModeControllerReturn {
  // Origin
  origin: Location | null;
  setLocalOrigin: (origin: Location | null) => void;
  handleOriginSelect: (loc: Partial<Location>) => void;
  // Config
  budget: number; setBudget: (v: number) => void;
  days: number; setDays: (v: number) => void;
  travelers: number; setTravelers: (v: number) => void;
  numRooms: number; setNumRooms: (v: number) => void;
  preferences: TripPreference[];
  accommodationType: 'budget' | 'moderate' | 'comfort';
  setAccommodationType: (v: 'budget' | 'moderate' | 'comfort') => void;
  isRoundTrip: boolean; setIsRoundTrip: (v: boolean) => void;
  departureDate: string; setDepartureDate: (v: string) => void;
  departureTime: string; setDepartureTime: (v: string) => void;
  // Search results
  destinations: AdventureDestination[];
  isCalculating: boolean;
  hasSearched: boolean;
  // Derived
  previewMaxKm: number;
  // Handlers
  togglePreference: (pref: TripPreference) => void;
  handleSelectDestination: (dest: AdventureDestination) => void;
}

function makeTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalYMD(d);
}

export function useAdventureModeController({
  initialOrigin,
  onOriginChange,
  onSelectDestination,
  onClose,
  fuelCostPerKm,
}: UseAdventureModeControllerOptions): UseAdventureModeControllerReturn {
  const [localOrigin, setLocalOrigin] = useState<Location | null>(initialOrigin);
  const [budget, setBudget] = useState(1000);
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [numRooms, setNumRooms] = useState(1);
  const [preferences, setPreferences] = useState<TripPreference[]>([]);
  const [accommodationType, setAccommodationType] = useState<'budget' | 'moderate' | 'comfort'>('moderate');
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [departureDate, setDepartureDate] = useState(makeTomorrow);
  const [departureTime, setDepartureTime] = useState('09:00');

  const [destinations, setDestinations] = useState<AdventureDestination[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const origin = localOrigin;

  // Debounced search — fires 500ms after any config change
  useEffect(() => {
    if (!origin || origin.lat === 0) return;
    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const result = await findAdventureDestinations({
          origin, budget, days, travelers, preferences, accommodationType, isRoundTrip, fuelCostPerKm, numRooms,
        });
        setDestinations(result.destinations);
        setHasSearched(true);
      } catch (error) {
        console.error('Adventure search failed:', error);
      } finally {
        setIsCalculating(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [origin, budget, days, travelers, numRooms, preferences, accommodationType, isRoundTrip, fuelCostPerKm]);

  const previewMaxKm = origin && origin.lat !== 0
    ? calculateMaxDistance({ origin, budget, days, travelers, preferences, accommodationType, isRoundTrip, fuelCostPerKm, numRooms })
    : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleOriginSelect = (loc: Partial<Location>) => {
    if (loc.lat && loc.lng) {
      const newOrigin: Location = {
        id: 'origin',
        name: loc.name || '',
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        type: 'origin',
      };
      setLocalOrigin(newOrigin);
      onOriginChange?.(newOrigin);
    }
  };

  const togglePreference = (pref: TripPreference) => {
    setPreferences(prev => prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]);
  };

  const handleSelectDestination = (dest: AdventureDestination) => {
    onSelectDestination({
      destination: dest.location,
      travelers, days, budget, isRoundTrip, accommodationType, preferences,
      departureDate, departureTime,
      estimatedDistanceKm: dest.distanceKm * (isRoundTrip ? 2 : 1),
    });
    onClose();
  };

  return {
    origin,
    setLocalOrigin,
    handleOriginSelect,
    budget, setBudget,
    days, setDays,
    travelers, setTravelers,
    numRooms, setNumRooms,
    preferences,
    accommodationType, setAccommodationType,
    isRoundTrip, setIsRoundTrip,
    departureDate, setDepartureDate,
    departureTime, setDepartureTime,
    destinations, isCalculating, hasSearched,
    previewMaxKm,
    togglePreference,
    handleSelectDestination,
  };
}

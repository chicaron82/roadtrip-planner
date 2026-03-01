import { useState, useEffect } from 'react';
import { Compass, MapPin, Sparkles, X } from 'lucide-react';
import type { Location, AdventureDestination, TripPreference } from '../../types';
import { findAdventureDestinations, calculateMaxDistance } from '../../lib/adventure-service';
import { LocationSearchInput } from './LocationSearchInput';
import { AdventureFormPanel } from './AdventureFormPanel';
import { AdventureResultsPanel } from './AdventureResultsPanel';
import { cn } from '../../lib/utils';

// Settings to carry over when selecting a destination
export interface AdventureSelection {
  destination: Location;
  travelers: number;
  days: number;
  budget: number; // Total trip budget amount
  isRoundTrip: boolean;
  accommodationType: 'budget' | 'moderate' | 'comfort';
  preferences: TripPreference[]; // Trip style preferences for budget profile mapping
  departureDate: string; // ISO date string
  departureTime: string; // HH:MM format
  estimatedDistanceKm: number; // For gas calculation
}

interface AdventureModeProps {
  origin: Location | null;
  onOriginChange?: (origin: Location) => void;
  onSelectDestination: (selection: AdventureSelection) => void;
  onClose: () => void;
  className?: string;
  /** Fuel cost per km derived from user's vehicle + gas price settings.
   *  When provided, overrides the hardcoded $0.12/km estimate in adventure-service. */
  fuelCostPerKm?: number;
}

export function AdventureMode({
  origin: externalOrigin,
  onOriginChange,
  onSelectDestination,
  onClose,
  className,
  fuelCostPerKm,
}: AdventureModeProps) {
  const [localOrigin, setLocalOrigin] = useState<Location | null>(externalOrigin);
  const origin = localOrigin;

  const [budget, setBudget] = useState(1000);
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [preferences, setPreferences] = useState<TripPreference[]>([]);
  const [accommodationType, setAccommodationType] = useState<'budget' | 'moderate' | 'comfort'>('moderate');
  const [isRoundTrip, setIsRoundTrip] = useState(true);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [departureDate, setDepartureDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [departureTime, setDepartureTime] = useState('09:00');

  const [destinations, setDestinations] = useState<AdventureDestination[]>([]);
  const [_maxReachableKm, setMaxReachableKm] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!origin || origin.lat === 0) return;
    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const result = await findAdventureDestinations({
          origin, budget, days, travelers, preferences, accommodationType, isRoundTrip, fuelCostPerKm,
        });
        setDestinations(result.destinations);
        setMaxReachableKm(result.maxReachableKm);
        setHasSearched(true);
      } catch (error) {
        console.error('Adventure search failed:', error);
      } finally {
        setIsCalculating(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [origin, budget, days, travelers, preferences, accommodationType, isRoundTrip, fuelCostPerKm]);

  const previewMaxKm = origin && origin.lat !== 0
    ? calculateMaxDistance({ origin, budget, days, travelers, preferences, accommodationType, isRoundTrip, fuelCostPerKm })
    : 0;

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

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4', className)}>
      <div className="w-full max-w-2xl md:max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 md:p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 md:top-4 md:right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Compass className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold">I'm Feeling Adventurous</h2>
              <p className="text-purple-200 text-xs md:text-sm">Enter your budget and see how far you can go!</p>
            </div>
          </div>
        </div>

        {/* Origin Search — inline when no starting location */}
        {(!origin || origin.lat === 0) && (
          <div className="px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4 border-b border-purple-200 bg-purple-50 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2 text-purple-800">
              <MapPin className="h-4 w-4" />
              <p className="text-sm font-semibold">Where are you starting from?</p>
            </div>
            <LocationSearchInput
              value=""
              placeholder="Search a city…"
              onSelect={(loc) => {
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
              }}
            />
          </div>
        )}

        {/* Origin indicator */}
        {origin && origin.lat !== 0 && (
          <div className="px-4 py-2 md:px-6 border-b border-purple-100 bg-purple-50/50 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-700 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              <span>Starting from <strong>{origin.name}</strong></span>
            </div>
            <button
              onClick={() => setLocalOrigin(null)}
              className="text-xs text-purple-400 hover:text-purple-600 transition-colors"
            >
              Change
            </button>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <AdventureFormPanel
            budget={budget} onBudgetChange={setBudget}
            days={days} onDaysChange={setDays}
            travelers={travelers} onTravelersChange={setTravelers}
            departureDate={departureDate} onDepartureDateChange={setDepartureDate}
            departureTime={departureTime} onDepartureTimeChange={setDepartureTime}
            accommodationType={accommodationType} onAccommodationTypeChange={setAccommodationType}
            isRoundTrip={isRoundTrip} onIsRoundTripChange={setIsRoundTrip}
            preferences={preferences} onTogglePreference={togglePreference}
            previewMaxKm={previewMaxKm}
            origin={origin}
          />
          <AdventureResultsPanel
            isCalculating={isCalculating}
            destinations={destinations}
            hasSearched={hasSearched}
            isRoundTrip={isRoundTrip}
            onSelectDestination={handleSelectDestination}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-center text-gray-400">
            Estimates based on average fuel costs, {accommodationType} hotels, and $50/person/day for food
          </p>
        </div>
      </div>
    </div>
  );
}

// Adventure Mode Trigger Button
interface AdventureButtonProps {
  onClick: () => void;
  className?: string;
}

export function AdventureButton({ onClick, className }: AdventureButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl border-2 border-dashed border-purple-300 bg-gradient-to-r from-purple-50 to-indigo-50',
        'hover:border-purple-400 hover:shadow-md transition-all group',
        className
      )}
    >
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Compass className="h-5 w-5 text-purple-600" />
        </div>
        <div className="text-left">
          <div className="font-bold text-purple-900">I'm Feeling Adventurous</div>
          <div className="text-xs text-purple-600">Enter a budget, see how far you can go!</div>
        </div>
        <Sparkles className="h-5 w-5 text-purple-400 group-hover:text-purple-600 transition-colors" />
      </div>
    </button>
  );
}

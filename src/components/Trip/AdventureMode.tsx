import { useState, useEffect } from 'react';
import {
  Compass,
  DollarSign,
  Calendar,
  Users,
  MapPin,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  Car,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import type { Location, AdventureDestination, TripPreference } from '../../types';
import { findAdventureDestinations, calculateMaxDistance } from '../../lib/adventure-service';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { cn } from '../../lib/utils';

interface AdventureModeProps {
  origin: Location | null;
  onSelectDestination: (destination: Location) => void;
  onClose: () => void;
  className?: string;
}

export function AdventureMode({
  origin,
  onSelectDestination,
  onClose,
  className,
}: AdventureModeProps) {
  // Form state
  const [budget, setBudget] = useState(1000);
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [preferences, setPreferences] = useState<TripPreference[]>([]);
  const [accommodationType, setAccommodationType] = useState<'budget' | 'moderate' | 'comfort'>('moderate');
  const [isRoundTrip, setIsRoundTrip] = useState(true);

  // Results state
  const [destinations, setDestinations] = useState<AdventureDestination[]>([]);
  const [_maxReachableKm, setMaxReachableKm] = useState(0); // For future map radius display
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Calculate on parameter changes (debounced effect)
  useEffect(() => {
    if (!origin || origin.lat === 0) return;

    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const result = await findAdventureDestinations({
          origin,
          budget,
          days,
          travelers,
          preferences,
          accommodationType,
          isRoundTrip,
        });
        setDestinations(result.destinations);
        setMaxReachableKm(result.maxReachableKm);
        setHasSearched(true);
      } catch (error) {
        console.error('Adventure search failed:', error);
      } finally {
        setIsCalculating(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [origin, budget, days, travelers, preferences, accommodationType, isRoundTrip]);

  // Quick preview of max distance
  const previewMaxKm = origin && origin.lat !== 0
    ? calculateMaxDistance({ origin, budget, days, travelers, preferences, accommodationType, isRoundTrip })
    : 0;

  const togglePreference = (pref: TripPreference) => {
    setPreferences(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    );
  };

  const handleSelectDestination = (dest: AdventureDestination) => {
    onSelectDestination(dest.location);
    onClose();
  };

  const categoryEmoji: Record<AdventureDestination['category'], string> = {
    city: '🏙️',
    nature: '🌲',
    beach: '🏖️',
    mountain: '⛰️',
    historic: '🏛️',
  };

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4', className)}>
      {/* Wider modal on desktop for two-column layout */}
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

        {/* Origin Check */}
        {(!origin || origin.lat === 0) && (
          <div className="p-4 md:p-6 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <div className="flex items-center gap-3 text-amber-800">
              <MapPin className="h-5 w-5" />
              <p className="text-sm font-medium">
                First, enter your starting location in Step 1, then come back here!
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout on desktop, stacked on mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Form Inputs */}
          <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r bg-gray-50 space-y-4 md:w-80 md:flex-shrink-0 md:overflow-y-auto">
            <div className="grid grid-cols-3 md:grid-cols-1 gap-4">
              {/* Budget */}
              <div>
                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <DollarSign className="h-3 w-3" /> Total Budget
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={budget}
                    onChange={(e) => setBudget(Math.max(100, parseInt(e.target.value) || 100))}
                    className="pl-7 text-lg font-bold"
                  />
                </div>
              </div>

              {/* Days */}
              <div>
                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <Calendar className="h-3 w-3" /> Days
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setDays(Math.max(1, days - 1))}
                  >
                    -
                  </Button>
                  <div className="flex-1 text-center text-lg font-bold">{days}</div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setDays(Math.min(14, days + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Travelers */}
              <div>
                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                  <Users className="h-3 w-3" /> Travelers
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setTravelers(Math.max(1, travelers - 1))}
                  >
                    -
                  </Button>
                  <div className="flex-1 text-center text-lg font-bold">{travelers}</div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setTravelers(Math.min(10, travelers + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Accommodation Type */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Accommodation Style</Label>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
                {(['budget', 'moderate', 'comfort'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAccommodationType(type)}
                    className={cn(
                      'p-2 rounded-lg border-2 text-sm font-medium transition-all capitalize',
                      accommodationType === type
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {type === 'budget' && '💰 '}
                    {type === 'moderate' && '🏨 '}
                    {type === 'comfort' && '✨ '}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Round Trip Toggle */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">Trip Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsRoundTrip(true)}
                  className={cn(
                    'p-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                    isRoundTrip
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <RotateCcw className="h-4 w-4" />
                  Round Trip
                </button>
                <button
                  onClick={() => setIsRoundTrip(false)}
                  className={cn(
                    'p-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                    !isRoundTrip
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <ArrowRight className="h-4 w-4" />
                  One Way
                </button>
              </div>
              {!isRoundTrip && (
                <p className="text-xs text-purple-600 mt-1.5 text-center">
                  Go twice as far! Plan to fly/bus back.
                </p>
              )}
            </div>

            {/* Trip Preferences */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">What kind of trip?</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: 'scenic' as const, label: '🌿 Scenic', desc: 'Nature & views' },
                  { id: 'family' as const, label: '👨‍👩‍👧‍👦 Family', desc: 'Kid-friendly' },
                  { id: 'budget' as const, label: '💸 Budget', desc: 'Save money' },
                  { id: 'foodie' as const, label: '🍴 Foodie', desc: 'Great eats' },
                ]).map((pref) => (
                  <button
                    key={pref.id}
                    onClick={() => togglePreference(pref.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                      preferences.includes(pref.id)
                        ? 'bg-purple-100 border-purple-300 text-purple-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {pref.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Distance Preview */}
            {previewMaxKm > 0 && (
              <div className="flex items-center justify-center gap-2 p-3 bg-purple-100 rounded-lg text-purple-800">
                <Car className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {isRoundTrip ? (
                    <>Up to <strong>{Math.round(previewMaxKm)} km</strong> each way</>
                  ) : (
                    <>Go up to <strong>{Math.round(previewMaxKm)} km</strong> one-way!</>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="flex-1 overflow-y-auto p-4">
          {isCalculating ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Sparkles className="h-8 w-8 text-purple-500 animate-pulse mx-auto mb-2" />
                <p className="text-sm text-gray-500">Finding adventures...</p>
              </div>
            </div>
          ) : destinations.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {destinations.length} destinations within your budget
              </p>

              {destinations.map((dest) => (
                <button
                  key={dest.id}
                  onClick={() => handleSelectDestination(dest)}
                  className="w-full text-left p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group"
                >
                  <div className="flex gap-4">
                    {/* Image */}
                    {dest.imageUrl && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={dest.imageUrl}
                          alt={dest.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <span>{categoryEmoji[dest.category]}</span>
                            {dest.name}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-1">{dest.description}</p>
                        </div>

                        {/* Score Badge */}
                        <div
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-bold',
                            dest.score >= 80
                              ? 'bg-green-100 text-green-700'
                              : dest.score >= 60
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {dest.score}%
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {dest.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dest.estimatedDriveHours}h drive
                        </span>
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <DollarSign className="h-3 w-3" />
                          ${dest.estimatedCosts.remaining} left to spend
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dest.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center text-gray-300 group-hover:text-purple-500 transition-colors">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Cost Breakdown (on hover) */}
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-gray-400">Gas</div>
                      <div className="font-medium">${dest.estimatedCosts.fuel}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Hotels</div>
                      <div className="font-medium">${dest.estimatedCosts.accommodation}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Food</div>
                      <div className="font-medium">${dest.estimatedCosts.food}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-400">Total</div>
                      <div className="font-bold text-purple-600">${dest.estimatedCosts.total}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">😢</div>
              <p className="text-gray-600 font-medium">No destinations found in budget</p>
              <p className="text-sm text-gray-400 mt-1">
                Try increasing your budget or days
                {isRoundTrip && ', or switch to one-way'}
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Compass className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Enter your starting location to begin</p>
            </div>
          )}
          </div>
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

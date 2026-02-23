import { Calendar, DollarSign, Users, Clock, Car, ArrowRight, RotateCcw } from 'lucide-react';
import type { Location, TripPreference } from '../../types';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { cn } from '../../lib/utils';

interface AdventureFormPanelProps {
  budget: number;
  onBudgetChange: (v: number) => void;
  days: number;
  onDaysChange: (v: number) => void;
  travelers: number;
  onTravelersChange: (v: number) => void;
  departureDate: string;
  onDepartureDateChange: (v: string) => void;
  departureTime: string;
  onDepartureTimeChange: (v: string) => void;
  accommodationType: 'budget' | 'moderate' | 'comfort';
  onAccommodationTypeChange: (v: 'budget' | 'moderate' | 'comfort') => void;
  isRoundTrip: boolean;
  onIsRoundTripChange: (v: boolean) => void;
  preferences: TripPreference[];
  onTogglePreference: (p: TripPreference) => void;
  previewMaxKm: number;
  origin: Location | null;
}

const PREFERENCE_OPTIONS = [
  { id: 'scenic' as const, label: '🌿 Scenic', desc: 'Nature & views' },
  { id: 'family' as const, label: '👨‍👩‍👧‍👦 Family', desc: 'Kid-friendly' },
  { id: 'budget' as const, label: '💸 Budget', desc: 'Save money' },
  { id: 'foodie' as const, label: '🍴 Foodie', desc: 'Great eats' },
];

export function AdventureFormPanel({
  budget, onBudgetChange,
  days, onDaysChange,
  travelers, onTravelersChange,
  departureDate, onDepartureDateChange,
  departureTime, onDepartureTimeChange,
  accommodationType, onAccommodationTypeChange,
  isRoundTrip, onIsRoundTripChange,
  preferences, onTogglePreference,
  previewMaxKm,
  origin,
}: AdventureFormPanelProps) {
  return (
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
              onChange={(e) => onBudgetChange(Math.max(100, parseInt(e.target.value) || 100))}
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
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onDaysChange(Math.max(1, days - 1))}>-</Button>
            <div className="flex-1 text-center text-lg font-bold">{days}</div>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onDaysChange(Math.min(14, days + 1))}>+</Button>
          </div>
        </div>

        {/* Travelers */}
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Users className="h-3 w-3" /> Travelers
          </Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onTravelersChange(Math.max(1, travelers - 1))}>-</Button>
            <div className="flex-1 text-center text-lg font-bold">{travelers}</div>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onTravelersChange(Math.min(10, travelers + 1))}>+</Button>
          </div>
        </div>
      </div>

      {/* Departure Date/Time */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Calendar className="h-3 w-3" /> Depart
          </Label>
          <Input
            type="date"
            value={departureDate}
            onChange={(e) => onDepartureDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3" /> Time
          </Label>
          <Input
            type="time"
            value={departureTime}
            onChange={(e) => onDepartureTimeChange(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Accommodation Type */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Accommodation Style</Label>
        <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
          {(['budget', 'moderate', 'comfort'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onAccommodationTypeChange(type)}
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

      {/* Auto / Manual route mode */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Route Mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onIsRoundTripChange(true)}
            className={cn(
              'p-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
              isRoundTrip ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <RotateCcw className="h-4 w-4" /> Auto
          </button>
          <button
            onClick={() => onIsRoundTripChange(false)}
            className={cn(
              'p-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
              !isRoundTrip ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <ArrowRight className="h-4 w-4" /> Manual
          </button>
        </div>
        {!isRoundTrip && (
          <p className="text-xs text-purple-600 mt-1.5 text-center">
            You plot every leg — including the return.
          </p>
        )}
      </div>

      {/* Trip Preferences */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">What kind of trip?</Label>
        <div className="flex flex-wrap gap-2">
          {PREFERENCE_OPTIONS.map((pref) => (
            <button
              key={pref.id}
              onClick={() => onTogglePreference(pref.id)}
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
      {previewMaxKm > 0 && origin && origin.lat !== 0 && (
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
  );
}

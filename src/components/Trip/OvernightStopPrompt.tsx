import { Hotel, MapPin, Clock, Users } from 'lucide-react';
import { Button } from '../UI/Button';
import type { Location } from '../../types';

interface OvernightStopPromptProps {
  suggestedLocation: Location;
  hoursBeforeStop: number;
  distanceBeforeStop: number;
  numTravelers: number;
  arrivalTime: string;
  departureTime: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function OvernightStopPrompt({
  suggestedLocation,
  hoursBeforeStop,
  distanceBeforeStop,
  numTravelers,
  arrivalTime,
  departureTime,
  onAccept,
  onDecline,
}: OvernightStopPromptProps) {
  // Calculate rooms needed based on travelers
  const roomsNeeded = Math.ceil(numTravelers / 2);
  const roomText = roomsNeeded === 1
    ? '1 room'
    : numTravelers <= 4
      ? `${roomsNeeded} rooms or family suite`
      : `${roomsNeeded} rooms`;

  return (
    <div className="border-2 border-purple-200 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
          <Hotel className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-purple-900 mb-1">
            🏨 Overnight Stay Recommended
          </h3>
          <p className="text-sm text-purple-700">
            This drive is quite long! A hotel stop will make your journey safer and more comfortable.
          </p>
        </div>
      </div>

      {/* Stop Details */}
      <div className="bg-white/80 rounded-lg p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-purple-900">Suggested stop: </span>
            <span className="text-purple-700">{suggestedLocation.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-purple-900">After: </span>
            <span className="text-purple-700">
              {hoursBeforeStop.toFixed(1)} hours ({distanceBeforeStop.toFixed(0)} km)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-purple-900">Accommodations: </span>
            <span className="text-purple-700">
              {roomText} for {numTravelers} {numTravelers === 1 ? 'traveler' : 'travelers'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Hotel className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-purple-900">Schedule: </span>
            <span className="text-purple-700">
              Arrive {arrivalTime} • Depart {departureTime}
            </span>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <div className="text-xs text-green-800">
          <div className="font-semibold mb-1">✨ Benefits of splitting your trip:</div>
          <ul className="list-disc list-inside space-y-0.5 text-green-700">
            <li>Safer driving - stay alert and refreshed</li>
            <li>More enjoyable journey - no rush to arrive</li>
            <li>Explore {suggestedLocation.name.split(',')[0]} along the way</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onAccept}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md"
        >
          <Hotel className="h-4 w-4 mr-2" />
          Add Hotel Stop
        </Button>
        <Button
          onClick={onDecline}
          variant="outline"
          className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          Keep Single Day
        </Button>
      </div>

      <p className="text-[10px] text-purple-600 text-center mt-2">
        You can always add or remove stops manually from the timeline
      </p>
    </div>
  );
}

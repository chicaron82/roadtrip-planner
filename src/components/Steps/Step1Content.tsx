import { Calendar } from 'lucide-react';
import type { Location, TripSettings } from '../../types';
import { LocationList } from '../Trip/LocationList';
import { AdventureButton } from '../Trip/AdventureMode';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';

interface Step1ContentProps {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  onShowAdventure: () => void;
}

export function Step1Content({
  locations,
  setLocations,
  settings,
  setSettings,
  onShowAdventure,
}: Step1ContentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Where are you going?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add your starting point, destination, and any stops along the way.
        </p>
        <LocationList
          locations={locations}
          setLocations={setLocations}
          onCalculate={() => {}}
          isCalculating={false}
          hideCalculateButton
        />

        {/* Round Trip Toggle */}
        <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🔄</div>
            <div>
              <div className="text-sm font-semibold text-blue-900">Round Trip</div>
              <div className="text-xs text-blue-600">
                Return to starting point (doubles costs & distance)
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.isRoundTrip}
              onChange={(e) => setSettings((prev) => ({ ...prev, isRoundTrip: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Adventure Mode Button */}
        <AdventureButton onClick={onShowAdventure} className="mt-4" />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            When?
          </h3>

          {/* Depart/Arrive Toggle */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
            <Button
              variant={!settings.useArrivalTime ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSettings((prev) => ({ ...prev, useArrivalTime: false }))}
              className="h-7 text-xs gap-1 transition-all"
            >
              🚗 Depart
            </Button>
            <Button
              variant={settings.useArrivalTime ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSettings((prev) => ({ ...prev, useArrivalTime: true }))}
              className="h-7 text-xs gap-1 transition-all"
            >
              🏁 Arrive
            </Button>
          </div>
        </div>

        {/* Date/Time Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label
              htmlFor={settings.useArrivalTime ? 'arrDate' : 'depDate'}
              className="text-xs"
            >
              {settings.useArrivalTime ? 'Arrival Date' : 'Departure Date'}
            </Label>
            <Input
              id={settings.useArrivalTime ? 'arrDate' : 'depDate'}
              type="date"
              value={settings.useArrivalTime ? settings.arrivalDate : settings.departureDate}
              onChange={(e) =>
                setSettings((prev) =>
                  settings.useArrivalTime
                    ? { ...prev, arrivalDate: e.target.value }
                    : { ...prev, departureDate: e.target.value }
                )
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label
              htmlFor={settings.useArrivalTime ? 'arrTime' : 'depTime'}
              className="text-xs"
            >
              {settings.useArrivalTime ? 'Arrival Time' : 'Departure Time'}
            </Label>
            <Input
              id={settings.useArrivalTime ? 'arrTime' : 'depTime'}
              type="time"
              value={settings.useArrivalTime ? settings.arrivalTime : settings.departureTime}
              onChange={(e) =>
                setSettings((prev) =>
                  settings.useArrivalTime
                    ? { ...prev, arrivalTime: e.target.value }
                    : { ...prev, departureTime: e.target.value }
                )
              }
              className="mt-1"
            />
          </div>
        </div>

        {/* Smart Preview */}
        <p className="text-xs text-muted-foreground mt-2 bg-purple-50 border border-purple-100 rounded-md p-2">
          {settings.useArrivalTime ? (
            <>
              🎯 <strong>Arrive by:</strong>{' '}
              {settings.arrivalDate && settings.arrivalTime
                ? `${new Date(settings.arrivalDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })} at ${settings.arrivalTime}`
                : 'Set your target arrival time'}
              {settings.arrivalDate && " - We'll calculate when you need to leave!"}
            </>
          ) : (
            <>
              🚗 <strong>Depart:</strong>{' '}
              {settings.departureDate && settings.departureTime
                ? `${new Date(settings.departureDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })} at ${settings.departureTime}`
                : 'Set your departure time'}
              {settings.departureDate &&
                new Date(settings.departureDate) > new Date() &&
                ` - Leaving in ${Math.ceil(
                  (new Date(settings.departureDate).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )} days!`}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

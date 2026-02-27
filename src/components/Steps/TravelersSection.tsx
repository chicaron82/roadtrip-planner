import { Users, UserCheck } from 'lucide-react';
import type { TripSettings } from '../../types';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';

interface TravelersSectionProps {
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
}

export function TravelersSection({ settings, setSettings }: TravelersSectionProps) {
  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        Who's joining your MEE time?
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Travelers Stepper */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Total Travellers
          </Label>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 mb-1">everyone on the trip</p>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 transition-transform active:scale-95"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  numTravelers: Math.max(1, prev.numTravelers - 1),
                  numDrivers: Math.min(prev.numDrivers, Math.max(1, prev.numTravelers - 1)),
                }))
              }
            >
              -
            </Button>
            <div className="flex-1 text-center">
              <div className="font-bold text-2xl">{settings.numTravelers}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 transition-transform active:scale-95"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  numTravelers: Math.min(20, prev.numTravelers + 1),
                }))
              }
            >
              +
            </Button>
          </div>
        </div>

        {/* Drivers Stepper */}
        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <UserCheck className="h-3 w-3" /> Can Drive
          </Label>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5 mb-1">included in total above</p>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 transition-transform active:scale-95"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  numDrivers: Math.max(1, prev.numDrivers - 1),
                }))
              }
            >
              -
            </Button>
            <div className="flex-1 text-center">
              <div className="font-bold text-2xl">{settings.numDrivers}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 transition-transform active:scale-95"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  numDrivers: Math.min(prev.numTravelers, prev.numDrivers + 1),
                }))
              }
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {/* Visual Ratio Indicator */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex gap-0.5">
          {Array.from({ length: settings.numTravelers }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < settings.numDrivers ? 'bg-green-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        <span>
          {settings.numTravelers} traveller{settings.numTravelers !== 1 ? 's' : ''}
          {' · '}{settings.numDrivers} can drive
          {settings.numTravelers - settings.numDrivers > 0 && (
            <> · {settings.numTravelers - settings.numDrivers} passenger{settings.numTravelers - settings.numDrivers !== 1 ? 's' : ''}</>
          )}
        </span>
      </div>

      {/* Smart Tip */}
      <p className="info-banner-blue text-xs text-muted-foreground mt-2 rounded-md p-2 border">
        💡{' '}
        {settings.numDrivers === 1
          ? 'Solo driver? Recommended max 8 hours per day for safety.'
          : settings.numDrivers === 2
          ? 'With 2 drivers, you can comfortably drive 12 hours by switching every 3 hours!'
          : `${settings.numDrivers} drivers allows for team rotation - up to 16+ hours possible!`}
      </p>
    </div>
  );
}

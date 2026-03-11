import { Users, UserCheck } from 'lucide-react';
import type { TripSettings } from '../../types';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';

interface TravelersSectionProps {
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
}

/** Default max drive hours per day based on driver count.
 *  Each driver contributes 8h of capacity (one drives, others rest).
 *  Capped at 24h — continuous relay ceiling. */
function getDefaultDriveHours(numDrivers: number): number {
  return Math.min(numDrivers * 8, 24);
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
                setSettings((prev) => {
                  const newTravelers = Math.max(1, prev.numTravelers - 1);
                  const newDrivers = Math.min(prev.numDrivers, newTravelers);
                  const prevDefault = getDefaultDriveHours(prev.numDrivers);
                  const newDefault = getDefaultDriveHours(newDrivers);
                  const wasAutoRooms = (prev.numRooms ?? Math.ceil(prev.numTravelers / 2)) === Math.ceil(prev.numTravelers / 2);
                  return {
                    ...prev,
                    numTravelers: newTravelers,
                    numDrivers: newDrivers,
                    maxDriveHours: newDrivers !== prev.numDrivers && prev.maxDriveHours === prevDefault
                      ? newDefault : prev.maxDriveHours,
                    numRooms: wasAutoRooms ? Math.ceil(newTravelers / 2) : prev.numRooms,
                  };
                })
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
                setSettings((prev) => {
                  const newTravelers = Math.min(20, prev.numTravelers + 1);
                  const wasAutoRooms = (prev.numRooms ?? Math.ceil(prev.numTravelers / 2)) === Math.ceil(prev.numTravelers / 2);
                  return {
                    ...prev,
                    numTravelers: newTravelers,
                    numRooms: wasAutoRooms ? Math.ceil(newTravelers / 2) : prev.numRooms,
                  };
                })
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
                setSettings((prev) => {
                  const newDrivers = Math.max(1, prev.numDrivers - 1);
                  const prevDefault = getDefaultDriveHours(prev.numDrivers);
                  const newDefault = getDefaultDriveHours(newDrivers);
                  return {
                    ...prev,
                    numDrivers: newDrivers,
                    maxDriveHours: prev.maxDriveHours === prevDefault ? newDefault : prev.maxDriveHours,
                    driverNames: Array.from({ length: newDrivers }, (_, i) => prev.driverNames?.[i] ?? ''),
                  };
                })
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
                setSettings((prev) => {
                  const newDrivers = Math.min(prev.numTravelers, prev.numDrivers + 1);
                  const prevDefault = getDefaultDriveHours(prev.numDrivers);
                  const newDefault = getDefaultDriveHours(newDrivers);
                  return {
                    ...prev,
                    numDrivers: newDrivers,
                    maxDriveHours: prev.maxDriveHours === prevDefault ? newDefault : prev.maxDriveHours,
                    driverNames: Array.from({ length: newDrivers }, (_, i) => prev.driverNames?.[i] ?? ''),
                  };
                })
              }
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {/* Driver Name Inputs */}
      {settings.numDrivers >= 2 && (
        <div className="mt-3">
          <Label className="text-xs text-muted-foreground">
            Driver names <span className="opacity-50">(optional)</span>
          </Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {Array.from({ length: settings.numDrivers }).map((_, i) => (
              <input
                key={i}
                type="text"
                maxLength={20}
                placeholder={`Driver ${i + 1}`}
                value={settings.driverNames?.[i] ?? ''}
                onChange={e => setSettings(prev => {
                  const names = Array.from({ length: prev.numDrivers }, (_, j) => prev.driverNames?.[j] ?? '');
                  names[i] = e.target.value;
                  return { ...prev, driverNames: names };
                })}
                className="w-24 text-xs border rounded px-2 py-1 bg-background"
              />
            ))}
          </div>
        </div>
      )}

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
          ? 'Co-pilot mode — 2 drivers unlocks up to 16h/day. One drives, one rests.'
          : `${settings.numDrivers}-driver relay — up to ${Math.min(settings.numDrivers * 8, 24)}h/day. True marathon mode.`}
      </p>
    </div>
  );
}

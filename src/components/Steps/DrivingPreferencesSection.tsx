import { Clock } from 'lucide-react';
import type { TripSettings } from '../../types';
import { Label } from '../UI/Label';
import { Switch } from '../UI/Switch';

interface DrivingPreferencesSectionProps {
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
}

export function DrivingPreferencesSection({ settings, setSettings }: DrivingPreferencesSectionProps) {
  const maxSlider = settings.numDrivers === 1 ? 10 : settings.numDrivers === 2 ? 16 : 20;

  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        Driving Preferences
      </h3>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-muted-foreground">Max driving hours per day</Label>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{settings.maxDriveHours}</span>
            <span className="text-xs text-muted-foreground">hours</span>
            {settings.maxDriveHours <= 6 && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                ✓ Short
              </span>
            )}
            {settings.maxDriveHours > 6 && settings.maxDriveHours <= 10 && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                ✓ Safe
              </span>
            )}
            {settings.maxDriveHours > 10 &&
              settings.maxDriveHours <= 14 &&
              settings.numDrivers >= 2 && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                  ! Extended
                </span>
              )}
            {settings.maxDriveHours > 10 && settings.numDrivers === 1 && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
                ⚠ Long
              </span>
            )}
            {settings.maxDriveHours > 14 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                ⚠ Marathon
              </span>
            )}
          </div>
        </div>

        {/* Color-Coded Slider */}
        <div className="relative pt-1 pb-2">
          <div className="absolute inset-0 flex h-2 rounded-full overflow-hidden">
            <div className="bg-green-500/30" style={{ width: '30%' }}></div>
            <div className="bg-yellow-500/30" style={{ width: '20%' }}></div>
            <div className="bg-orange-500/30" style={{ width: '25%' }}></div>
            <div className="bg-red-500/30" style={{ width: '25%' }}></div>
          </div>

          <input
            type="range"
            min={1}
            max={maxSlider}
            value={settings.maxDriveHours}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, maxDriveHours: parseInt(e.target.value) }))
            }
            className="relative w-full h-2 bg-transparent appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-primary
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-white
              [&::-moz-range-thumb]:shadow-lg"
          />

          <div className="relative mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>1h</span>
            <span className="absolute" style={{ left: `${(8 - 1) / (maxSlider - 1) * 100}%`, transform: 'translateX(-50%)' }}>8h</span>
            <span className="absolute" style={{ left: `${(12 - 1) / (maxSlider - 1) * 100}%`, transform: 'translateX(-50%)' }}>12h</span>
            {settings.numDrivers > 2 && (
              <span className="absolute" style={{ left: `${(16 - 1) / (20 - 1) * 100}%`, transform: 'translateX(-50%)' }}>16h</span>
            )}
            <span>
              {settings.numDrivers === 1 ? '10h' : settings.numDrivers === 2 ? '16h' : '20h'}
            </span>
          </div>
        </div>

        {/* Dynamic Recommendation */}
        <p className="info-banner-blue text-xs mt-3 p-2 rounded-md border">
          {settings.numDrivers === 1 &&
            settings.maxDriveHours <= 8 &&
            '✨ Recommended: 8 hours max for safe solo driving.'}
          {settings.numDrivers === 1 &&
            settings.maxDriveHours > 8 &&
            settings.maxDriveHours <= 10 &&
            '⚠️ Solo driver at 9-10 hours. Plan rest stops every 2 hours!'}
          {settings.numDrivers === 1 &&
            settings.maxDriveHours > 10 &&
            '🛑 Solo driver limit exceeded. Consider adding a second driver or splitting into multi-day trip.'}
          {settings.numDrivers === 2 &&
            settings.maxDriveHours <= 12 &&
            '✨ Perfect! With 2 drivers, swap every 3-4 hours for optimal alertness.'}
          {settings.numDrivers === 2 &&
            settings.maxDriveHours > 12 &&
            settings.maxDriveHours <= 16 &&
            '⚡ Extended driving (12-16h). Ensure both drivers are well-rested!'}
          {settings.numDrivers >= 3 &&
            settings.maxDriveHours <= 12 &&
            '✨ Team driving! Rotate every 2-3 hours for maximum comfort.'}
          {settings.numDrivers >= 3 &&
            settings.maxDriveHours > 12 &&
            '🚀 Marathon mode! Ensure proper rotation and rest breaks.'}
        </p>
      </div>

      {/* Target Arrival Time */}
      <div className="border-t pt-4 mt-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">🕐 Daily Arrival Target</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transit days auto-depart so you arrive by this time.
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {settings.targetArrivalHour < 12
              ? `${settings.targetArrivalHour}:00 AM`
              : settings.targetArrivalHour === 12
                ? '12:00 PM'
                : `${settings.targetArrivalHour - 12}:00 PM`}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {([17, 18, 19, 20, 21] as const).map((hour) => {
            const label = `${hour - 12} PM`;
            const isSelected = settings.targetArrivalHour === hour;
            return (
              <button
                key={hour}
                onClick={() => setSettings((prev) => ({ ...prev, targetArrivalHour: hour }))}
                className={`py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="info-banner-blue text-xs mt-3 p-2 rounded-md border">
          {(() => {
            const depart = Math.max(5, Math.min(10, Math.round(settings.targetArrivalHour - settings.maxDriveHours)));
            const departLabel = depart === 12 ? '12:00 PM' : depart > 12 ? `${depart - 12}:00 PM` : `${depart}:00 AM`;
            const arriveLabel = settings.targetArrivalHour > 12 ? `${settings.targetArrivalHour - 12}:00 PM` : `${settings.targetArrivalHour}:00 AM`;
            return `🗓️ Transit days will depart around ${departLabel} to arrive by ${arriveLabel}.`;
          })()}
        </p>
      </div>
      {/* Beast Mode */}
      <div className={`mt-4 flex items-center justify-between p-3 rounded-lg border transition-colors ${settings.beastMode ? 'bg-amber-500/10 border-amber-500/40' : 'bg-muted/20 border-border'}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <div>
            <Label className="cursor-pointer font-medium text-sm" htmlFor="beast-mode">
              Beast Mode
            </Label>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {settings.beastMode ? 'Drive-time cap bypassed — relay team only' : 'Override the overnight cap for marathon drives'}
            </p>
          </div>
        </div>
        <Switch
          id="beast-mode"
          checked={settings.beastMode ?? false}
          onCheckedChange={(checked) => setSettings(prev => ({ ...prev, beastMode: checked }))}
        />
      </div>

      {/* Fuel Price */}
      <div className="mt-3 flex items-center justify-between p-3 rounded-lg border bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-base">⛽</span>
          <div>
            <Label htmlFor="fuel-price" className="cursor-pointer font-medium text-sm">
              Fuel Price
            </Label>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {settings.currency}/L · Regional estimate from origin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <input
            id="fuel-price"
            type="number"
            step="0.01"
            min="0"
            value={settings.gasPrice}
            onChange={(e) => setSettings(prev => ({ ...prev, gasPrice: parseFloat(e.target.value) || 0 }))}
            className="w-16 text-right bg-background border border-border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">/L</span>
        </div>
      </div>
    </div>
  );
}

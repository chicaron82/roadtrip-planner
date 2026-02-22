import { Clock, Users, UserCheck } from 'lucide-react';
import type { Vehicle, TripSettings, TripBudget, TripMode } from '../../types';
import { VehicleForm } from '../Vehicle/VehicleForm';
import { BudgetInput } from '../Trip/BudgetInput';
import { StylePresetRow } from '../Trip/StylePresetRow';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import type { StylePreset } from '../../lib/style-presets';

interface Step2ContentProps {
  vehicle: Vehicle;
  setVehicle: React.Dispatch<React.SetStateAction<Vehicle>>;
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  tripMode: TripMode;
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  onPresetChange: (preset: StylePreset) => void;
  onSharePreset: () => void;
  shareJustCopied?: boolean;
}

export function Step2Content({
  vehicle,
  setVehicle,
  settings,
  setSettings,
  tripMode,
  activePreset,
  presetOptions,
  onPresetChange,
  onSharePreset,
  shareJustCopied,
}: Step2ContentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Your Vehicle</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select or configure your vehicle for accurate fuel estimates.
        </p>
        <VehicleForm
          vehicle={vehicle}
          setVehicle={setVehicle}
          units={settings.units}
          setUnits={(value) =>
            setSettings((prev) => ({
              ...prev,
              units: typeof value === 'function' ? value(prev.units) : value,
            }))
          }
        />
      </div>

      {/* Trip Type Quick Presets */}
      <div className="border-t pt-4">
        <Label className="text-xs text-muted-foreground mb-2 block">Quick Setup</Label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '🎒 Solo', travelers: 1, drivers: 1, hours: 8 },
            { label: '💑 Couple', travelers: 2, drivers: 1, hours: 8 },
            { label: '👨‍👩‍👧‍👦 Family', travelers: 4, drivers: 2, hours: 6 },
            { label: '👥 Group', travelers: 6, drivers: 3, hours: 10 },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  numTravelers: preset.travelers,
                  numDrivers: preset.drivers,
                  maxDriveHours: preset.hours,
                }))
              }
              className="text-xs h-auto py-2 px-2 hover:bg-primary/5 hover:border-primary/50 transition-all"
            >
              <div className="text-center">
                <div className="text-sm mb-0.5">{preset.label.split(' ')[0]}</div>
                <div className="text-[10px] text-muted-foreground">
                  {preset.label.split(' ')[1]}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Who's coming?
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
              max={settings.numDrivers === 1 ? 10 : settings.numDrivers === 2 ? 16 : 20}
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
              <span className="absolute" style={{ left: `${(8 - 1) / ((settings.numDrivers === 1 ? 10 : settings.numDrivers === 2 ? 16 : 20) - 1) * 100}%`, transform: 'translateX(-50%)' }}>8h</span>
              <span className="absolute" style={{ left: `${(12 - 1) / ((settings.numDrivers === 1 ? 10 : settings.numDrivers === 2 ? 16 : 20) - 1) * 100}%`, transform: 'translateX(-50%)' }}>12h</span>
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
              const label = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
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
      </div>

      {/* Stop Frequency Preference */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">🛑 Stop Frequency</h3>
        <p className="text-xs text-muted-foreground mb-3">
          How often should we suggest fuel and rest stops?
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(['conservative', 'balanced', 'aggressive'] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => setSettings((prev) => ({ ...prev, stopFrequency: freq }))}
              className={`p-3 rounded-lg border-2 transition-all ${
                settings.stopFrequency === freq
                  ? 'border-blue-500 bg-blue-500/15'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="text-center">
                <div className="text-sm font-medium capitalize mb-1">{freq}</div>
                <div className="text-[10px] text-muted-foreground">
                  {freq === 'conservative' && 'More frequent\nsafer stops'}
                  {freq === 'balanced' && 'Standard\nintervals'}
                  {freq === 'aggressive' && 'Push further\nfewer stops'}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="info-banner-purple text-xs mt-3 p-2 rounded-md border">
          {settings.stopFrequency === 'conservative' &&
            '🛡️ Conservative: Stop every 1.5 hours, refuel at 30% tank. Best for solo drivers or those with kids.'}
          {settings.stopFrequency === 'balanced' &&
            '⚖️ Balanced: Stop every 2 hours, refuel at 25% tank. Recommended for most trips.'}
          {settings.stopFrequency === 'aggressive' &&
            '⚡ Aggressive: Stop every 2.5 hours, refuel at 20% tank. For experienced drivers who prefer fewer stops.'}
        </p>
      </div>

      {/* Trip Preferences */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">🏷️ Trip Style</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Choose your preferences to get personalized POI suggestions
        </p>

        {/* Avoid Borders Toggle */}
        <button
          onClick={() => setSettings((prev) => ({ ...prev, avoidBorders: !prev.avoidBorders }))}
          className={`w-full mb-4 p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
            settings.avoidBorders
              ? 'border-red-500/40 bg-red-500/10'
              : 'border-border hover:border-muted-foreground/30'
          }`}
        >
          <span className="text-xl">🛂</span>
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              Stay In-Country
              {settings.avoidBorders && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">ON</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {settings.avoidBorders
                ? 'Route will avoid crossing international borders — no passport needed'
                : 'Tap to keep your route from crossing into another country'}
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            settings.avoidBorders ? 'bg-red-500 justify-end' : 'bg-gray-300 justify-start'
          }`}>
            <div className="w-5 h-5 bg-white rounded-full shadow-sm" />
          </div>
        </button>

        <p className="text-[10px] text-muted-foreground/70 mb-4 leading-relaxed">
          Routes are suggestions only — use Google Maps or your preferred navigation app for turn-by-turn directions. You can export your trip from the results page.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'scenic' as const, label: 'Scenic', emoji: '🌿', desc: 'Viewpoints & nature' },
            { id: 'family' as const, label: 'Family', emoji: '👨‍👩‍👧‍👦', desc: 'Kid-friendly stops' },
            { id: 'budget' as const, label: 'Budget', emoji: '💸', desc: 'Free/cheap attractions' },
            { id: 'foodie' as const, label: 'Foodie', emoji: '🍴', desc: 'Local restaurants' },
          ].map((pref) => (
            <button
              key={pref.id}
              onClick={() => {
                setSettings((prev) => ({
                  ...prev,
                  tripPreferences: prev.tripPreferences.includes(pref.id)
                    ? prev.tripPreferences.filter((p) => p !== pref.id)
                    : [...prev.tripPreferences, pref.id],
                }));
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                settings.tripPreferences.includes(pref.id)
                  ? 'border-primary bg-primary/15'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{pref.emoji}</span>
                <span className="text-sm font-semibold">{pref.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">{pref.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Trip Budget — hidden in estimate mode (we're calculating it for them) */}
      {tripMode === 'estimate' ? (
        <div className="border-t pt-4">
          <div className="info-banner-blue p-4 rounded-xl border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-sm font-semibold">We'll Calculate Your Budget</div>
                <div className="text-xs text-muted-foreground">
                  Hit "Estimate My Trip" and we'll break down gas, hotels, food, and activities based on your vehicle and route.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t pt-4">
          {/* Travel Style preset row */}
          <StylePresetRow
            activePreset={activePreset}
            presetOptions={presetOptions}
            onPresetChange={onPresetChange}
            tripMode={tripMode}
            onShare={onSharePreset}
            shareJustCopied={shareJustCopied}
          />
          <BudgetInput
            budget={settings.budget}
            onChange={(newBudget: TripBudget) =>
              setSettings((prev) => ({ ...prev, budget: newBudget }))
            }
            currency={settings.currency}
            numTravelers={settings.numTravelers}
          />
        </div>
      )}
    </div>
  );
}

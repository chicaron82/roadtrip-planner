import type { Vehicle, TripSettings, TripMode } from '../../types';
import { VehicleForm } from '../Vehicle/VehicleForm';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import type { StylePreset } from '../../lib/style-presets';
import { TravelersSection } from './TravelersSection';
import { DrivingPreferencesSection } from './DrivingPreferencesSection';
import { StopFrequencySection } from './StopFrequencySection';
import { TripStyleSection } from './TripStyleSection';

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

      <TravelersSection settings={settings} setSettings={setSettings} />
      <DrivingPreferencesSection settings={settings} setSettings={setSettings} />
      <StopFrequencySection settings={settings} setSettings={setSettings} />
      <TripStyleSection
        settings={settings}
        setSettings={setSettings}
        tripMode={tripMode}
        activePreset={activePreset}
        presetOptions={presetOptions}
        onPresetChange={onPresetChange}
        onSharePreset={onSharePreset}
        shareJustCopied={shareJustCopied}
      />
    </div>
  );
}

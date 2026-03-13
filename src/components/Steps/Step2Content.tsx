import { Users, BedDouble, Clock } from 'lucide-react';
import type { Vehicle, TripSettings, TripMode } from '../../types';
import { VehicleForm } from '../Vehicle/VehicleForm';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import { CollapsibleSection } from '../UI/CollapsibleSection';
import type { StylePreset } from '../../lib/style-presets';
import { TravelersSection } from './TravelersSection';
import { AccommodationSection } from './AccommodationSection';
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
  // Derived summaries for collapsed section chips
  const numRooms = settings.numRooms ?? Math.ceil(settings.numTravelers / 2);
  const travelersSummary = `${settings.numTravelers} traveller${settings.numTravelers !== 1 ? 's' : ''} · ${settings.numDrivers} driver${settings.numDrivers !== 1 ? 's' : ''}`;
  const accommodationSummary = `${numRooms} room${numRooms !== 1 ? 's' : ''} · $${settings.hotelPricePerNight}/night`;
  const drivingSummary = `${settings.maxDriveHours}h max · ${settings.stopFrequency}`;
  const styleSummary = activePreset.name;
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
            { label: '🎒 Solo',         travelers: 1, drivers: 1, hours: 8,  rooms: 1 },
            { label: '💑 Couple',       travelers: 2, drivers: 1, hours: 8,  rooms: 1 },
            { label: '👨‍👩‍👧‍👦 Family', travelers: 4, drivers: 2, hours: 6,  rooms: 2 },
            { label: '👥 Group',        travelers: 6, drivers: 3, hours: 10, rooms: 3 },
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
                  numRooms: preset.rooms,
                  driverNames: Array.from({ length: preset.drivers }, (_, i) => prev.driverNames?.[i] ?? ''),
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

      <CollapsibleSection
        title="Travelers"
        icon={<Users className="h-4 w-4" />}
        summary={travelersSummary}
      >
        <TravelersSection headless settings={settings} setSettings={setSettings} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Accommodation"
        icon={<BedDouble className="h-4 w-4" />}
        summary={accommodationSummary}
      >
        <AccommodationSection headless settings={settings} setSettings={setSettings} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Driving Preferences"
        icon={<Clock className="h-4 w-4" />}
        summary={drivingSummary}
      >
        <DrivingPreferencesSection headless settings={settings} setSettings={setSettings} />
        <StopFrequencySection headless settings={settings} setSettings={setSettings} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Trip Style & Budget"
        icon="🏷️"
        summary={styleSummary}
      >
        <TripStyleSection
          headless
          settings={settings}
          setSettings={setSettings}
          tripMode={tripMode}
          activePreset={activePreset}
          presetOptions={presetOptions}
          onPresetChange={onPresetChange}
          onSharePreset={onSharePreset}
          shareJustCopied={shareJustCopied}
        />
      </CollapsibleSection>
    </div>
  );
}

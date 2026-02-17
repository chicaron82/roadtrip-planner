import { Calendar, Upload } from 'lucide-react';
import { useRef } from 'react';
import type { Location, TripChallenge, TripMode, TripSettings } from '../../types';
import { parseSharedTemplate, type TemplateImportResult } from '../../lib/url';
import { showToast } from '../../lib/toast';
import { LocationList } from '../Trip/LocationList';
import { ChallengeCards } from '../Trip/ChallengeCards';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';

const MODE_HEADERS: Record<TripMode, { title: string; subtitle: string }> = {
  plan: { title: 'Where are you going?', subtitle: 'Add your starting point, destination, and any stops along the way.' },
  adventure: { title: 'Where are you starting from?', subtitle: 'Set your origin — we\'ll find your adventure.' },
  estimate: { title: 'What\'s the route?', subtitle: 'Add your stops — we\'ll calculate what it\'ll cost.' },
};

interface Step1ContentProps {
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  tripMode: TripMode;
  onShowAdventure: () => void;
  onImportTemplate?: (result: TemplateImportResult) => void;
  onSelectChallenge?: (challenge: TripChallenge) => void;
}

export function Step1Content({
  locations,
  setLocations,
  settings,
  setSettings,
  tripMode,
  onShowAdventure,
  onImportTemplate,
  onSelectChallenge,
}: Step1ContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseSharedTemplate(reader.result as string);
        onImportTemplate?.(result);
        showToast({
          message: `Loaded "${result.meta.title}" by ${result.meta.author}!`,
          type: 'success',
          duration: 4000,
        });
      } catch {
        showToast({
          message: 'Invalid template file. Please use a file shared from The Experience Engine.',
          type: 'error',
          duration: 5000,
        });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">{MODE_HEADERS[tripMode].title}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {MODE_HEADERS[tripMode].subtitle}
        </p>
        <LocationList
          locations={locations}
          setLocations={setLocations}
          onCalculate={() => {}}
          isCalculating={false}
          hideCalculateButton
        />

        {/* One-Way Toggle (default is round trip) */}
        <div className={`mt-4 flex items-center justify-between p-3 rounded-lg border transition-colors ${settings.isRoundTrip ? 'border-blue-500/30 bg-blue-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{settings.isRoundTrip ? '🔄' : '➡️'}</div>
            <div>
              <div className={`text-sm font-semibold ${settings.isRoundTrip ? 'text-blue-300' : 'text-amber-300'}`}>
                {settings.isRoundTrip ? 'Round Trip' : 'One-Way Journey'}
              </div>
              <div className="text-xs text-muted-foreground">
                {settings.isRoundTrip
                  ? 'Returning to starting point (doubles costs & distance)'
                  : 'No return — costs & distance for outbound only'}
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!settings.isRoundTrip}
              onChange={(e) => setSettings((prev) => ({ ...prev, isRoundTrip: !e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* Adventure Mode Button — only show in plan mode as secondary option */}
        {tripMode === 'plan' && (
          <button
            onClick={onShowAdventure}
            className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-amber-500/40 text-sm text-amber-400 hover:border-amber-400 hover:bg-amber-500/10 transition-all"
          >
            🧭 Switch to Adventure Mode
          </button>
        )}

        {/* Chicharon's Challenges */}
        {onSelectChallenge && (
          <div className="mt-4">
            <ChallengeCards onSelectChallenge={onSelectChallenge} />
          </div>
        )}

        {/* Import Shared Template */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-green-500/30 text-sm text-muted-foreground hover:border-green-400 hover:text-green-400 hover:bg-green-500/10 transition-all"
        >
          <Upload className="h-4 w-4" />
          Load a Shared Trip Template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
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
        <p className="info-banner-purple text-xs mt-2 rounded-md p-2 border">
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

import { Calendar, Upload } from 'lucide-react';
import { useRef } from 'react';
import type { Location, TripChallenge, TripMode, TripSettings } from '../../types';
import { parseSharedTemplate, type TemplateImportResult } from '../../lib/url';
import { showToast } from '../../lib/toast';
import { LocationList } from '../Trip/LocationList';
import { ChallengeCards } from '../Trip/ChallengeCards';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import { DateRangePicker } from '../UI/DateRangePicker';
import { ClockPicker } from '../UI/ClockPicker';

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
          message: 'Invalid template file. Please use a file shared from My Experience Engine.',
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
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-primary" />
          When?
        </h3>

        {/* Date Range — single calendar range picker */}
        <div className="mb-3">
          <DateRangePicker
            startDate={settings.departureDate}
            endDate={settings.returnDate}
            onChange={(start, end) =>
              setSettings((prev) => ({ ...prev, departureDate: start, returnDate: end }))
            }
          />
        </div>

        {/* Time + Arrive By toggle */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="depTime" className="text-xs">
              {settings.useArrivalTime ? 'Arrive By' : 'Departure Time'}
            </Label>
            <ClockPicker
              value={settings.useArrivalTime ? (settings.arrivalTime || '17:00') : settings.departureTime}
              onChange={(v) =>
                setSettings((prev) =>
                  settings.useArrivalTime
                    ? { ...prev, arrivalTime: v }
                    : { ...prev, departureTime: v }
                )
              }
            />
          </div>
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 mt-5">
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

        {/* Smart Preview */}
        <p className="info-banner-purple text-xs mt-3 rounded-md p-2 border">
          {(() => {
            const depDate = settings.departureDate;
            const retDate = settings.returnDate;
            // Append T00:00:00 to parse as local time, not UTC
            // (bare 'YYYY-MM-DD' is parsed as UTC midnight → rolls back a day in western timezones)
            const parseLocal = (d: string) => new Date(d + 'T00:00:00');
            const tripDays = depDate && retDate
              ? Math.max(1, Math.ceil((parseLocal(retDate).getTime() - parseLocal(depDate).getTime()) / (1000 * 60 * 60 * 24)))
              : 0;
            const daysUntilTrip = depDate && parseLocal(depDate) > new Date()
              ? Math.ceil((parseLocal(depDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : 0;

            const depFormatted = depDate
              ? parseLocal(depDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : '';
            const retFormatted = retDate
              ? parseLocal(retDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : '';

            if (depDate && retDate) {
              return (
                <>
                  🗓️ <strong>{depFormatted}</strong> → <strong>{retFormatted}</strong>
                  {' · '}{tripDays}-day trip
                  {settings.useArrivalTime && settings.arrivalTime && ` · Arrive by ${settings.arrivalTime}`}
                  {!settings.useArrivalTime && settings.departureTime && ` · Leaving at ${settings.departureTime}`}
                  {daysUntilTrip > 0 && ` · ${daysUntilTrip} days away!`}
                </>
              );
            }
            if (depDate) {
              return (
                <>
                  🚗 <strong>Depart:</strong> {depFormatted}
                  {settings.departureTime && ` at ${settings.departureTime}`}
                  {daysUntilTrip > 0 && ` · ${daysUntilTrip} days away!`}
                  {' · '}Set a return date for trip duration
                </>
              );
            }
            return <>Set your departure and return dates</>;
          })()}
        </p>
      </div>

      <div className="border-t pt-4">
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
            <ChallengeCards
              onSelectChallenge={onSelectChallenge}
              initialOrigin={locations.find(l => l.type === 'origin') ?? locations[0] ?? null}
            />
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

    </div>
  );
}

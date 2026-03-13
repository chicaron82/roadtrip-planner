import { Calendar, Upload } from 'lucide-react';
import type { Location, TripChallenge, TripMode, TripSettings } from '../../types';
import type { TemplateImportResult } from '../../lib/url';
import { useStep1Controller } from '../../hooks/useStep1Controller';
import { LocationList } from '../Trip/Location/LocationList';
import { ChallengeCards } from '../Trip/Adventure/ChallengeCards';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import { Switch } from '../UI/Switch';
import { DateRangePicker } from '../UI/DateRangePicker';
import { ClockPicker } from '../UI/ClockPicker';
import { CollapsibleSection } from '../UI/CollapsibleSection';

const MODE_HEADERS: Record<TripMode, { title: string; subtitle: string }> = {
  plan: { title: 'Where is your MEE time?', subtitle: 'Add your starting point, destination, and any stops along the way.' },
  adventure: { title: 'Where does your MEE time begin?', subtitle: 'Set your origin — we\'ll find your adventure.' },
  estimate: { title: 'Where is your MEE time?', subtitle: 'Add your stops — we\'ll calculate what it\'ll cost.' },
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
  const {
    openEndedDismissed, setOpenEndedDismissed,
    isOpenEnded, isSingleDay,
    origin, lastDest,
    targetArrivalLabel, smartPreview,
    fileInputRef, handleImportFile,
  } = useStep1Controller({ locations, settings, onImportTemplate });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-primary" />
          When is your MEE time?
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
              {settings.useArrivalTime ? 'Day 1 Arrival' : 'Day 1 Departure'}
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

        {/* Daily Arrival Target — hidden for same-day trips */}
        {!isSingleDay && (
        <CollapsibleSection
          title="Daily Arrival Target"
          icon="🕐"
          summary={targetArrivalLabel}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground mt-0.5">
                Each transit day auto-schedules its departure to hit this time.
              </p>
              <span className="text-sm font-semibold tabular-nums">{targetArrivalLabel}</span>
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
            🗓️ Transit days will auto-schedule departure to arrive by {targetArrivalLabel}.
          </p>
          </div>
        </CollapsibleSection>
        )}

        {/* Smart Preview */}
        <p className="info-banner-purple text-xs mt-3 rounded-md p-2 border">
          {smartPreview.hasDateRange ? (
            <>
              🗓️ <strong>{smartPreview.depFormatted}</strong> → <strong>{smartPreview.retFormatted}</strong>
              {' · '}{smartPreview.tripDays}-day trip
              {settings.useArrivalTime && settings.arrivalTime && ` · Arrive by ${settings.arrivalTime}`}
              {!settings.useArrivalTime && settings.departureTime && ` · Leaving at ${settings.departureTime}`}
              {smartPreview.daysUntilTrip > 0 && ` · ${smartPreview.daysUntilTrip} days away!`}
            </>
          ) : smartPreview.hasDepartureOnly ? (
            <>
              🚗 <strong>Depart:</strong> {smartPreview.depFormatted}
              {settings.departureTime && ` at ${settings.departureTime}`}
              {smartPreview.daysUntilTrip > 0 && ` · ${smartPreview.daysUntilTrip} days away!`}
              {' · '}Set a return date for trip duration
            </>
          ) : (
            <>Set your departure and return dates</>
          )}
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

        {/* Auto / Manual route mode */}
        <CollapsibleSection
          title="Route Mode"
          icon="🔄"
          summary={settings.isRoundTrip
            ? `Auto${(settings.dayTripDurationHours ?? 0) > 0 ? ` · ${settings.dayTripDurationHours}h at destination` : ''}`
            : 'Manual'}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSettings(prev => ({ ...prev, isRoundTrip: true }))}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                settings.isRoundTrip
                  ? 'border-green-500/50 bg-green-500/10 text-green-300'
                  : 'border-white/10 text-muted-foreground hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span>🔄</span>
                <span className="text-sm font-semibold">Auto</span>
              </div>
              <div className="text-xs opacity-60">Returns to start</div>
            </button>
            <button
              onClick={() => { setSettings(prev => ({ ...prev, isRoundTrip: false })); setOpenEndedDismissed(false); }}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                !settings.isRoundTrip
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : 'border-white/10 text-muted-foreground hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span>✏️</span>
                <span className="text-sm font-semibold">Manual</span>
              </div>
              <div className="text-xs opacity-60">You plot the full route</div>
            </button>
          </div>

          {/* Day trip duration */}
          {settings.isRoundTrip && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1.5">Time at destination</div>
              <div className="flex gap-1.5 flex-wrap">
                {([0, 1, 2, 3, 4, 6] as const).map(h => (
                  <button
                    key={h}
                    onClick={() => setSettings(prev => ({ ...prev, dayTripDurationHours: h }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      (settings.dayTripDurationHours ?? 0) === h
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-muted/40 text-muted-foreground border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {h === 0 ? 'None' : `${h}h`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Open-ended trip nudge */}
          {isOpenEnded && !openEndedDismissed && (
            <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <span>↗ Your trip ends in <strong>{lastDest!.name}</strong>, not {origin!.name}. Intentional?</span>
              <button
                onClick={() => setOpenEndedDismissed(true)}
                className="shrink-0 font-semibold hover:text-amber-200 transition-colors"
              >
                Got it ✓
              </button>
            </div>
          )}
        </CollapsibleSection>

        {/* Adventure Mode Button */}
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

        {/* Load MEE Time Template */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-green-500/30 text-sm text-muted-foreground hover:border-green-400 hover:text-green-400 hover:bg-green-500/10 transition-all"
        >
          <Upload className="h-4 w-4" />
          Load a MEE Time Template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />

        {/* Privacy — hide starting location from exported templates */}
        <div className="mt-3 flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <div>
              <Label className="cursor-pointer font-medium text-sm" htmlFor="include-start">
                Include starting location in shared templates
              </Label>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {(settings.includeStartingLocation ?? true)
                  ? 'Starting location will appear in exported templates'
                  : 'Origin will be hidden when you share or export this trip'}
              </p>
            </div>
          </div>
          <Switch
            id="include-start"
            checked={settings.includeStartingLocation ?? true}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, includeStartingLocation: checked }))}
          />
        </div>
      </div>

    </div>
  );
}

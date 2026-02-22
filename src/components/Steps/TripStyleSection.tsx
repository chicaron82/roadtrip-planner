import type { TripSettings, TripBudget, TripMode } from '../../types';
import { BudgetInput } from '../Trip/BudgetInput';
import { StylePresetRow } from '../Trip/StylePresetRow';
import type { StylePreset } from '../../lib/style-presets';

interface TripStyleSectionProps {
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  tripMode: TripMode;
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  onPresetChange: (preset: StylePreset) => void;
  onSharePreset: () => void;
  shareJustCopied?: boolean;
}

export function TripStyleSection({
  settings,
  setSettings,
  tripMode,
  activePreset,
  presetOptions,
  onPresetChange,
  onSharePreset,
  shareJustCopied,
}: TripStyleSectionProps) {
  return (
    <>
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
    </>
  );
}

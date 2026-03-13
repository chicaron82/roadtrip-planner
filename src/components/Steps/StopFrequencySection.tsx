import type { TripSettings } from '../../types';

interface StopFrequencySectionProps {
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
  /** Suppresses the outer border-t/pt-4 and the section heading. */
  headless?: boolean;
}

export function StopFrequencySection({ settings, setSettings, headless = false }: StopFrequencySectionProps) {
  return (
    <div className={headless ? '' : 'border-t pt-4'}>
      {!headless && (
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">🛑 Stop Frequency</h3>
      )}
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
  );
}

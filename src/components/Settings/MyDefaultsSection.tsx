import { useState } from 'react';
import type { UnitSystem, Currency } from '../../types';
import { getLastOrigin, getEntryPreference, saveEntryPreference } from '../../lib/storage';

interface MyDefaultsSectionProps {
  units: UnitSystem;
  currency: Currency;
  numTravelers: number;
  numDrivers: number;
  onChange: (updates: { units?: UnitSystem; currency?: Currency; numTravelers?: number; numDrivers?: number }) => void;
}

export function MyDefaultsSection({ units, currency, numTravelers, numDrivers, onChange }: MyDefaultsSectionProps) {
  const lastOrigin = getLastOrigin();
  const [entryPref, setEntryPref] = useState(getEntryPreference() ?? 'conversational');

  const handleEntryPrefChange = (pref: 'conversational' | 'classic') => {
    setEntryPref(pref);
    saveEntryPreference(pref);
  };

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  return (
    <div className="space-y-4">
      {/* Home city */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Home City</p>
        <p className="text-sm text-zinc-200 font-medium">
          {lastOrigin ? lastOrigin.name : <span className="text-zinc-500 italic">Not set — enter a start city in Step 1</span>}
        </p>
      </div>

      {/* Units */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Units</p>
        <div className="flex gap-2">
          {(['metric', 'imperial'] as UnitSystem[]).map((u) => (
            <button
              key={u}
              onClick={() => onChange({ units: u })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                units === u
                  ? 'bg-sky-500 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {u === 'metric' ? 'Metric (km)' : 'Imperial (mi)'}
            </button>
          ))}
        </div>
      </div>

      {/* Currency */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Currency</p>
        <div className="flex gap-2">
          {(['CAD', 'USD'] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => onChange({ currency: c })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                currency === c
                  ? 'bg-sky-500 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {c === 'CAD' ? '🍁 CAD' : '🇺🇸 USD'}
            </button>
          ))}
        </div>
      </div>

      {/* Travelers */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Default Travellers</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Travellers</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ numTravelers: clamp(numTravelers - 1, 1, 12) })}
                className="w-8 h-8 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 text-lg leading-none"
                aria-label="Decrease travellers"
              >−</button>
              <span className="w-6 text-center text-sm font-semibold text-zinc-100">{numTravelers}</span>
              <button
                onClick={() => onChange({ numTravelers: clamp(numTravelers + 1, 1, 12) })}
                className="w-8 h-8 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 text-lg leading-none"
                aria-label="Increase travellers"
              >+</button>
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Drivers</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ numDrivers: clamp(numDrivers - 1, 1, numTravelers) })}
                className="w-8 h-8 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 text-lg leading-none"
                aria-label="Decrease drivers"
              >−</button>
              <span className="w-6 text-center text-sm font-semibold text-zinc-100">{numDrivers}</span>
              <button
                onClick={() => onChange({ numDrivers: clamp(numDrivers + 1, 1, numTravelers) })}
                className="w-8 h-8 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 text-lg leading-none"
                aria-label="Increase drivers"
              >+</button>
            </div>
          </div>
        </div>
      </div>
      {/* Entry Experience */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Entry Experience</p>
        <div className="flex gap-2">
          {([
            { value: 'conversational', label: 'Walk me through it' },
            { value: 'classic', label: 'Jump straight in' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleEntryPrefChange(value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                entryPref === value
                  ? 'bg-sky-500 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-1.5">
          {entryPref === 'conversational'
            ? 'MEE guides you through each mode step by step.'
            : 'Go straight to the planner every time.'}
        </p>
      </div>
    </div>
  );
}

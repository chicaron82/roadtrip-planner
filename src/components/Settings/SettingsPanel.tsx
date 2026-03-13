import { useState } from 'react';
import { Settings, X, MapPin, Palette, Shield, Info } from 'lucide-react';
import type { UnitSystem, Currency, HotelTier } from '../../types';
import { loadSettingsDefaults, saveSettingsDefaults } from '../../lib/storage';
import { HOTEL_TIERS } from '../../lib/budget';
import { DEFAULT_SETTINGS } from '../../stores/tripStore';
import { CollapsibleSection } from '../UI/CollapsibleSection';
import { MyDefaultsSection } from './MyDefaultsSection';
import { TravelStyleSection } from './TravelStyleSection';
import { PrivacySection } from './PrivacySection';
import { AboutSection } from './AboutSection';

interface SettingsState {
  units: UnitSystem;
  currency: Currency;
  numTravelers: number;
  numDrivers: number;
  gasPrice: number;
  hotelTier: HotelTier;
  mealPricePerDay: number;
  includeStartingLocation: boolean;
}

function loadInitialState(): SettingsState {
  const stored = loadSettingsDefaults();
  return {
    units: stored.units ?? DEFAULT_SETTINGS.units,
    currency: stored.currency ?? DEFAULT_SETTINGS.currency,
    numTravelers: stored.numTravelers ?? DEFAULT_SETTINGS.numTravelers,
    numDrivers: stored.numDrivers ?? DEFAULT_SETTINGS.numDrivers,
    gasPrice: stored.gasPrice ?? DEFAULT_SETTINGS.gasPrice,
    hotelTier: (stored.hotelTier as HotelTier | undefined) ?? DEFAULT_SETTINGS.hotelTier ?? 'regular',
    mealPricePerDay: stored.mealPricePerDay ?? DEFAULT_SETTINGS.mealPricePerDay,
    includeStartingLocation: stored.includeStartingLocation ?? false,
  };
}

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(loadInitialState);

  const persist = (updates: Partial<SettingsState>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    // Ensure hotelPricePerNight stays in sync with tier
    const hotelPricePerNight = HOTEL_TIERS[next.hotelTier].price;
    saveSettingsDefaults({
      ...DEFAULT_SETTINGS,
      ...next,
      hotelPricePerNight,
    });
  };

  const handleOpen = () => {
    setSettings(loadInitialState());
    setIsOpen(true);
  };

  return (
    <>
      {/* Gear button — always visible at bottom of panel */}
      <button
        onClick={handleOpen}
        aria-label="Open settings"
        className="flex items-center justify-center w-full py-2 border-t border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/30 transition-colors text-xs gap-1.5"
      >
        <Settings size={13} />
        Preferences
      </button>

      {/* Settings overlay */}
      {isOpen && (
        <div className="absolute inset-0 z-30 sidebar-dark flex flex-col md:rounded-[20px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/60 shrink-0">
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-sky-400" />
              <span className="text-sm font-semibold text-zinc-100">Preferences</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close settings"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto overscroll-contain py-2">
            <CollapsibleSection title="My Defaults" icon={<MapPin size={14} />} defaultOpen={true}>
              <MyDefaultsSection
                units={settings.units}
                currency={settings.currency}
                numTravelers={settings.numTravelers}
                numDrivers={settings.numDrivers}
                onChange={persist}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Travel Style" icon={<Palette size={14} />}>
              <TravelStyleSection
                hotelTier={settings.hotelTier}
                gasPrice={settings.gasPrice}
                mealPricePerDay={settings.mealPricePerDay}
                onChange={persist}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Privacy & Data" icon={<Shield size={14} />}>
              <PrivacySection
                includeStartingLocation={settings.includeStartingLocation}
                onIncludeStartingLocationChange={(v) => persist({ includeStartingLocation: v })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Open Source Credits" icon={<Info size={14} />}>
              <AboutSection />
            </CollapsibleSection>
          </div>
        </div>
      )}
    </>
  );
}

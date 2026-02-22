import { useState, useMemo, useCallback, useRef } from 'react';
import type { TripSettings } from '../types';
import {
  BUILTIN_PRESETS,
  CHICHARON_CLASSIC,
  parsePresetFromURL,
  copyPresetShareURL,
  type StylePreset,
} from '../lib/style-presets';
import {
  getAdaptiveDefaults,
  isAdaptiveMeaningful,
  type AdaptiveDefaults,
} from '../lib/user-profile';
import { showToast } from '../lib/toast';

interface UseStylePresetOptions {
  setSettings: (updater: (prev: TripSettings) => TripSettings) => void;
}

interface UseStylePresetReturn {
  activePreset: StylePreset;
  presetOptions: StylePreset[];
  shareJustCopied: boolean;
  adaptiveDefaults: AdaptiveDefaults | null;
  handlePresetChange: (preset: StylePreset) => void;
  handleSharePreset: () => Promise<void>;
  setAdaptiveDefaults: (defaults: AdaptiveDefaults | null) => void;
  refreshAdaptiveDefaults: () => AdaptiveDefaults | null;
}

export function useStylePreset({ setSettings }: UseStylePresetOptions): UseStylePresetReturn {
  const [adaptiveDefaults, setAdaptiveDefaults] = useState<AdaptiveDefaults | null>(null);
  const [activePreset, setActivePreset] = useState<StylePreset>(
    () => parsePresetFromURL() ?? CHICHARON_CLASSIC
  );
  const [shareJustCopied, setShareJustCopied] = useState(false);
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presetOptions = useMemo((): StylePreset[] => {
    if (!adaptiveDefaults || !isAdaptiveMeaningful(adaptiveDefaults)) return BUILTIN_PRESETS;
    const myStyle: StylePreset = {
      id: 'my-mee-style',
      name: 'My MEE Style',
      creatorName: 'You',
      hotelPricePerNight: adaptiveDefaults.hotelPricePerNight,
      mealPricePerDay: adaptiveDefaults.mealPricePerDay,
      description: `Based on your last ${adaptiveDefaults.tripCount} trip${adaptiveDefaults.tripCount !== 1 ? 's' : ''}.`,
    };
    return [CHICHARON_CLASSIC, myStyle];
  }, [adaptiveDefaults]);

  const handlePresetChange = useCallback((preset: StylePreset) => {
    setActivePreset(preset);
    setSettings(prev => ({
      ...prev,
      hotelPricePerNight: preset.hotelPricePerNight,
      mealPricePerDay: preset.mealPricePerDay,
    }));
  }, [setSettings]);

  const handleSharePreset = useCallback(async () => {
    await copyPresetShareURL(activePreset);
    setShareJustCopied(true);
    if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    shareCopiedTimerRef.current = setTimeout(() => setShareJustCopied(false), 2000);
    showToast({ message: '"Make my MEE time, your MEE time." — Link copied!', type: 'success' });
  }, [activePreset]);

  // Call after a trip is calculated to update adaptive defaults from history
  const refreshAdaptiveDefaults = useCallback((): AdaptiveDefaults | null => {
    const defaults = getAdaptiveDefaults();
    setAdaptiveDefaults(defaults);
    return defaults;
  }, []);

  return {
    activePreset,
    presetOptions,
    shareJustCopied,
    adaptiveDefaults,
    handlePresetChange,
    handleSharePreset,
    setAdaptiveDefaults,
    refreshAdaptiveDefaults,
  };
}

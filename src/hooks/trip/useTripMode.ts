import { useState, useEffect, useRef, useCallback } from 'react';
import type { TripMode } from '../../types';

interface UseTripModeReturn {
  tripMode: TripMode | null;
  setTripMode: (mode: TripMode | null) => void;
  showAdventureMode: boolean;
  setShowAdventureMode: (show: boolean) => void;
  showModeSwitcher: boolean;
  setShowModeSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  modeSwitcherRef: React.RefObject<HTMLDivElement | null>;
  tripActive: boolean;
  setTripActive: (active: boolean) => void;
  handleContinueSavedTrip: () => void;
  handleSwitchMode: (mode: TripMode) => void;
}

export function useTripMode(): UseTripModeReturn {
  const [tripMode, setTripMode] = useState<TripMode | null>(null);
  const [showAdventureMode, setShowAdventureMode] = useState(false);
  const [showModeSwitcher, setShowModeSwitcher] = useState(false);
  const [tripActive, setTripActive] = useState(false);
  const modeSwitcherRef = useRef<HTMLDivElement>(null);

  // Close mode switcher when clicking outside
  useEffect(() => {
    if (!showModeSwitcher) return;
    const handler = (e: MouseEvent) => {
      if (modeSwitcherRef.current && !modeSwitcherRef.current.contains(e.target as Node)) {
        setShowModeSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModeSwitcher]);

  const handleContinueSavedTrip = useCallback(() => {
    setTripMode('plan');
  }, []);

  const handleSwitchMode = useCallback((mode: TripMode) => {
    if (mode === 'adventure') { setTripMode('adventure'); setShowAdventureMode(true); }
    else setTripMode(mode);
  }, [setTripMode, setShowAdventureMode]);

  return {
    tripMode,
    setTripMode,
    showAdventureMode,
    setShowAdventureMode,
    showModeSwitcher,
    setShowModeSwitcher,
    modeSwitcherRef,
    tripActive,
    setTripActive,
    handleContinueSavedTrip,
    handleSwitchMode,
  };
}

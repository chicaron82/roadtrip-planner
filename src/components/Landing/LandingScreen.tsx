/**
 * ═══════════════════════════════════════════════════════════
 * MY EXPERIENCE ENGINE — LANDING SCREEN
 * "The open road is calling. How are you answering?"
 *
 * Floats above the always-present map. Same warm glass system
 * as the planner panel — rgba(14,11,7) dark, orange accent,
 * Cormorant Garamond editorial type.
 *
 * 💚 Built by Aaron "Chicharon" — 18 years on the road
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect } from 'react';
import type { TripMode } from '../../types';
import { getEntryPreference, saveEntryPreference } from '../../lib/storage';
import { ROUTE_DOTS } from './mode-config';
import { LandingHeroSection } from './LandingHeroSection';
import { LandingFooter } from './LandingFooter';
import { LandingRouteScene } from './LandingRouteScene';
import './landing.css';

export interface LandingScreenProps {
  onSelectMode: (mode: TripMode) => void;
  hasSavedTrip?: boolean;
  onContinueSavedTrip?: () => void;
  hasActiveSession?: boolean;
  onResumeSession?: () => void;
  lastDestination?: string;
}

export function LandingScreen({ onSelectMode, hasSavedTrip, onContinueSavedTrip, hasActiveSession, onResumeSession, lastDestination }: LandingScreenProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [entryPreference, setEntryPreference] = useState(getEntryPreference);

  // Staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Heartbeat orb
  useEffect(() => {
    const t = setTimeout(() => setPulseActive(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Animate route dots
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot(prev => (prev + 1) % ROUTE_DOTS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = (mode: TripMode) => {
    setIsExiting(true);
    setTimeout(() => onSelectMode(mode), 600);
  };

  return (
    <div
      className="landing-screen"
      style={{
        opacity: isExiting ? 0 : mounted ? 1 : 0,
        transform: isExiting ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      {/* Warm dark overlay — lets map breathe through */}
      <div className="landing-bg-overlay" />

      {/* Warm orange aurora */}
      <div
        className="landing-aurora"
        style={{ animation: 'landing-aurora 12s ease-in-out infinite' }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'safe center',
          padding: 'clamp(16px, 3vh, 40px) 20px',
          gap: 'clamp(16px, 2.5vh, 32px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <LandingHeroSection pulseActive={pulseActive} />
        <LandingRouteScene
          onSelectMode={handleSelect}
          lastDestination={lastDestination}
          hasActiveSession={hasActiveSession}
          onResumeSession={onResumeSession}
          hasSavedTrip={hasSavedTrip}
          onContinueSavedTrip={onContinueSavedTrip}
          onExitStart={(fn) => { setIsExiting(true); setTimeout(fn, 600); }}
        />

        {entryPreference === 'classic' && (
          <button
            onClick={() => {
              saveEntryPreference('conversational');
              setEntryPreference('conversational');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(245, 240, 232, 0.35)',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '4px',
              textDecoration: 'underline',
            }}
          >
            ✦ Try the guided experience →
          </button>
        )}

        <LandingFooter activeDot={activeDot} />
</div>
    </div>
  );
}

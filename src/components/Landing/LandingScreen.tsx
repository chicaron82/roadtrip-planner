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
import { MODE_CONFIG, MODE_ORDER, ROUTE_DOTS } from './mode-config';
import { LandingHeroSection } from './LandingHeroSection';
import { LandingFooter } from './LandingFooter';
import './landing.css';

interface LandingScreenProps {
  onSelectMode: (mode: TripMode) => void;
  hasSavedTrip?: boolean;
  onContinueSavedTrip?: () => void;
  hasActiveSession?: boolean;
  onResumeSession?: () => void;
}

export function LandingScreen({ onSelectMode, hasSavedTrip, onContinueSavedTrip, hasActiveSession, onResumeSession }: LandingScreenProps) {
  const [hoveredMode, setHoveredMode] = useState<TripMode | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeDot, setActiveDot] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);

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
        <LandingHeroSection
          pulseActive={pulseActive}
          hasSavedTrip={hasSavedTrip}
          onContinueSavedTrip={onContinueSavedTrip}
          hasActiveSession={hasActiveSession}
          onResumeSession={onResumeSession}
          onExitStart={(fn) => { setIsExiting(true); setTimeout(fn, 600); }}
        />
        {/* Mode cards */}
        <div
          className="landing-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            width: '100%',
            maxWidth: '900px',
          }}
        >
          {MODE_ORDER.map((mode, index) => {
            const config = MODE_CONFIG[mode];
            return (
              <div
                key={mode}
                className={`landing-mode-card landing-card-${index + 1}`}
                style={{
                  '--card-glow': `radial-gradient(ellipse at 50% 0%, ${config.glowColor} 0%, transparent 70%)`,
                  '--card-border': config.borderColor,
                  '--card-shadow': config.glowColor,
                  '--stat-color': config.accentColor,
                  '--cta-bg': `${config.accentColor}22`,
                  '--cta-color': config.tagColor,
                  '--cta-hover-bg': `${config.accentColor}33`,
                } as React.CSSProperties}
                onMouseEnter={() => setHoveredMode(mode)}
                onMouseLeave={() => setHoveredMode(null)}
                onClick={() => handleSelect(mode)}
                tabIndex={0}
                role="button"
                aria-label={`${config.tag}: ${config.description}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(mode);
                  }
                }}
              >
                {/* Card accent line */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '20%',
                  right: '20%',
                  height: '2px',
                  background: `linear-gradient(to right, transparent, ${config.accentColor}, transparent)`,
                  borderRadius: '0 0 2px 2px',
                  opacity: hoveredMode === mode ? 1 : 0.4,
                  transition: 'opacity 0.3s ease',
                }} />

                {/* Tag */}
                <div
                  className="landing-mode-tag"
                  style={{
                    background: `${config.accentColor}18`,
                    color: config.tagColor,
                    border: `1px solid ${config.accentColor}40`,
                  }}
                >
                  <span>{config.icon}</span>
                  {config.tag}
                </div>

                {/* Heading */}
                <h2 className="landing-mode-heading">{config.heading}</h2>

                {/* Sub */}
                <p className="landing-mode-sub">{config.sub}</p>

                {/* Stats */}
                <ul className="landing-mode-stats">
                  {config.stats.map((stat) => (
                    <li key={stat}>{stat}</li>
                  ))}
                </ul>

                {/* CTA */}
                <button className="landing-mode-cta">{config.cta}</button>
              </div>
            );
          })}
        </div>

        <LandingFooter activeDot={activeDot} />
</div>
    </div>
  );
}

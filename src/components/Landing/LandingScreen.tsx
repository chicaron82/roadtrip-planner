/**
 * ═══════════════════════════════════════════════════════════
 * MY EXPERIENCE ENGINE — LANDING SCREEN
 * "The open road is calling. How are you answering?"
 *
 * First impression. Experience over utility.
 * Three modes. One invitation.
 *
 * 💚 Built by Aaron "Chicharon" — 18 years on the road
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect } from 'react';
import type { TripMode } from '../../types';
import { MODE_CONFIG, MODE_ORDER, ROUTE_DOTS } from './mode-config';
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

  // Staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
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
      {/* Background layers */}
      <div className="landing-starfield" />
      <div
        className="landing-aurora"
        style={{ animation: 'landing-aurora 12s ease-in-out infinite' }}
      />

      {/* Route map SVG background */}
      <svg className="landing-route-map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <path
          d="M 5,55 Q 12,42 22,52 Q 32,58 38,44 Q 48,36 58,46 Q 65,52 70,52 Q 77,50 83,44"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="0.3"
          fill="none"
          strokeDasharray="1,2"
        />
        <path
          d="M 5,55 Q 8,48 12,42 Q 16,36 18,30 Q 20,24 25,20"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.2"
          fill="none"
          strokeDasharray="0.5,2"
        />
        <path
          d="M 83,44 Q 88,40 92,38 Q 96,36 98,30"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="0.2"
          fill="none"
          strokeDasharray="0.5,2"
        />
        {ROUTE_DOTS.map((dot, i) => (
          <circle
            key={dot.label}
            cx={dot.x}
            cy={dot.y}
            r={i === activeDot ? 1.2 : 0.6}
            fill={i === activeDot ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'}
            style={{ transition: 'all 0.4s ease' }}
          />
        ))}
      </svg>

      <div className="landing-road-texture" />

      {/* Main content — scrollable when content exceeds viewport */}
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
        {/* Hero section */}
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          <p
            className="landing-hero-eyebrow"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            My Experience Engine™
          </p>

          <h1 className="landing-hero-title" style={{
            fontSize: 'clamp(28px, 4.5vw, 52px)',
            fontWeight: 800,
            color: '#F8FAFF',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            margin: '0 0 10px',
          }}>
            The Open Road
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #22C55E 0%, #3B82F6 50%, #F59E0B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Is Calling.
            </span>
          </h1>

          <p className="landing-hero-sub" style={{
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            color: 'rgba(255,255,255,0.4)',
            lineHeight: 1.5,
            margin: '0 0 14px',
            fontWeight: 300,
          }}>
            Not just a planner. A decision framework for travel.
            <br />
            Built on 18 years of real-world trips.
          </p>

          {/* Active Session Resume Button - Only show if a session was rehydrated */}
          {hasActiveSession && onResumeSession && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                color: '#F59E0B',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                ✦ Session restored from background
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExiting(true);
                  setTimeout(() => onResumeSession(), 600);
                }}
                className="resume-session-btn"
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#FDE68A',
                  padding: '10px 24px',
                  borderRadius: '100px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.1)';
                }}
              >
                Resume where you left off →
              </button>
            </div>
          )}

          {/* Lifecycle indicator */}
          <div className="landing-lifecycle" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.12em',
          }}>
            {['DISCOVER', 'VALIDATE', 'BUILD', 'REFINE'].map((step, i) => (
              <span key={step}>
                {i > 0 && <span style={{ opacity: 0.3, marginRight: '10px' }}>→</span>}
                <span style={{ opacity: 0.5 }}>{step}</span>
              </span>
            ))}
            <span style={{ opacity: 0.3 }}>→</span>
            <span style={{
              color: '#22C55E',
              textShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
            }}>
              COMMIT
            </span>
          </div>
        </div>

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
                  '--cta-color': config.accentColor,
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

        {/* Footer */}
        <div className="landing-footer" style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}>
          <div className="landing-divider" />
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: '0.1em',
            margin: 0,
          }}>
            My Experience Engine™ · Built by Aaron "Chicharon" with help from the crew.
          </p>

          {/* Continue saved trip */}
          {hasSavedTrip && onContinueSavedTrip && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExiting(true);
                setTimeout(() => onContinueSavedTrip(), 600);
              }}
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                color: 'rgba(255,255,255,0.12)',
                letterSpacing: '0.08em',
                margin: '6px 0 0',
                cursor: 'pointer',
                transition: 'color 0.2s',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.12)')}
            >
              Continue a Saved Trip →
            </button>
          )}

          {/* Live route dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            {ROUTE_DOTS.map((dot, i) => (
              <div
                key={dot.label}
                title={dot.label}
                style={{
                  width: i === activeDot ? '20px' : '4px',
                  height: '4px',
                  borderRadius: '100px',
                  background: i === activeDot ? '#22C55E' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            ))}
          </div>

          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            color: 'rgba(255,255,255,0.15)',
            letterSpacing: '0.08em',
            margin: 0,
            transition: 'opacity 0.4s ease',
          }}>
            {ROUTE_DOTS[activeDot]?.label ?? ''}
          </p>
        </div>
      </div>
    </div>
  );
}

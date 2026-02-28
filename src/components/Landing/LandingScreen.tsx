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
        {/* Hero section */}
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>

          {/* Eyebrow with heartbeat orb */}
          <div
            className="landing-hero-eyebrow"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#f97316',
              flexShrink: 0,
              boxShadow: pulseActive
                ? '0 0 0 5px rgba(249,115,22,0.15), 0 0 0 10px rgba(249,115,22,0.06)'
                : '0 0 0 0px rgba(249,115,22,0)',
              transition: 'box-shadow 1.2s ease',
            }} />
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              margin: 0,
            }}>
              My Experience Engine™ (MEE)
            </p>
          </div>

          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '0.05em',
              marginBottom: '14px',
              fontStyle: 'italic',
            }}
          >
            /pronounced "me"/
          </p>

          {/* Hero title — Cormorant Garamond */}
          <h1 className="landing-hero-title" style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(36px, 5.5vw, 68px)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#F8FAFF',
            lineHeight: 1.0,
            letterSpacing: '-0.01em',
            margin: '0 0 14px',
          }}>
            The Open Road
            <br />
            <span style={{
              fontStyle: 'normal',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #f97316 0%, #fb923c 60%, #fbbf24 100%)',
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
            Start planning. Get driving. Enjoy your MEE time.
          </p>

          {/* Continue Saved Trip */}
          {hasSavedTrip && onContinueSavedTrip && !hasActiveSession && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                color: '#fb923c',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                ✦ You have a saved trip
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExiting(true);
                  setTimeout(() => onContinueSavedTrip(), 600);
                }}
                style={{
                  background: 'rgba(249, 115, 22, 0.12)',
                  border: '1px solid rgba(249, 115, 22, 0.35)',
                  color: '#FDBA74',
                  padding: '10px 24px',
                  borderRadius: '100px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 20px rgba(249, 115, 22, 0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 115, 22, 0.22)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(249, 115, 22, 0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 115, 22, 0.12)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.08)';
                }}
              >
                Continue where you left off →
              </button>
            </div>
          )}

          {/* Active Session Resume */}
          {hasActiveSession && onResumeSession && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                color: '#fb923c',
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
                  background: 'rgba(249, 115, 22, 0.15)',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  color: '#FDBA74',
                  padding: '10px 24px',
                  borderRadius: '100px',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 20px rgba(249, 115, 22, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 115, 22, 0.25)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(249, 115, 22, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 115, 22, 0.15)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.1)';
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
              color: '#f97316',
              textShadow: '0 0 8px rgba(249, 115, 22, 0.5)',
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
            My Experience Engine™ · Built by Aaron "Chicharon" with help from the{' '}
            <a
              href="https://chicaron82.github.io/Version-848/#who"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'rgba(255,255,255,0.35)',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(255,255,255,0.15)',
                textUnderlineOffset: '3px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              United Voices 7 (UV7) crew
            </a>.
          </p>

          {/* Live route dots — orange accent */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            {ROUTE_DOTS.map((dot, i) => (
              <div
                key={dot.label}
                title={dot.label}
                style={{
                  width: i === activeDot ? '20px' : '4px',
                  height: '4px',
                  borderRadius: '100px',
                  background: i === activeDot ? '#f97316' : 'rgba(255,255,255,0.15)',
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

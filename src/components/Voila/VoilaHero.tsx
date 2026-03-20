/**
 * VoilaHero — The ta-da moment.
 *
 * Reading order (spec):
 *   1. Route label — large serif, seen first
 *   2. Trip title — dominant emotional layer
 *   3. Reveal line — "✦ Here's your MEE time." — orange, mono, subordinate
 *
 * 💚 My Experience Engine — Voilà reveal hero
 */

interface VoilaHeroProps {
  routeLabel: string;   // "Winnipeg → Thunder Bay"
  title: string;        // seeded or custom trip title
}

export function VoilaHero({ routeLabel, title }: VoilaHeroProps) {
  return (
    <div style={{ padding: '48px 32px 24px', textAlign: 'center' }}>
      {/* Route label — first breath, seen first */}
      <p style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(22px, 4vw, 32px)',
        fontWeight: 500,
        color: 'rgba(245, 240, 232, 0.6)',
        letterSpacing: '0.02em',
        margin: '0 0 24px',
        lineHeight: 1.15,
      }}>
        {routeLabel}
      </p>

      {/* Trip title — dominant emotional layer */}
      <h1 style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(28px, 5.5vw, 42px)',
        fontWeight: 600,
        color: '#f5f0e8',
        lineHeight: 1.2,
        margin: '0 0 24px',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h1>

      {/* Reveal line — confirmation, not a shout */}
      <p style={{
        fontFamily: '"DM Mono", "Courier New", monospace',
        fontSize: 12,
        color: '#f97316',
        letterSpacing: '0.1em',
        margin: 0,
        opacity: 0.85,
      }}>
        ✦ Here&apos;s your MEE time.
      </p>
    </div>
  );
}

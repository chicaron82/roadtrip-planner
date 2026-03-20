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
    <div style={{ padding: '32px 28px 20px', textAlign: 'center' }}>
      {/* Route label — first breath, largest */}
      <p style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(18px, 3.5vw, 28px)',
        fontWeight: 500,
        color: 'rgba(245, 240, 232, 0.65)',
        letterSpacing: '0.01em',
        margin: '0 0 16px',
        lineHeight: 1.2,
      }}>
        {routeLabel}
      </p>

      {/* Trip title — dominant */}
      <h1 style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(26px, 5vw, 38px)',
        fontWeight: 600,
        color: '#f5f0e8',
        lineHeight: 1.25,
        margin: '0 0 20px',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h1>

      {/* Reveal line — confirmation, not a shout */}
      <p style={{
        fontFamily: '"DM Mono", "Courier New", monospace',
        fontSize: 13,
        color: '#f97316',
        letterSpacing: '0.08em',
        margin: 0,
        opacity: 0.9,
      }}>
        ✦ Here&apos;s your MEE time.
      </p>
    </div>
  );
}

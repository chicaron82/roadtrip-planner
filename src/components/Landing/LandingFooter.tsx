import { ROUTE_DOTS } from './mode-config';

interface Props {
  activeDot: number;
}

export function LandingFooter({ activeDot }: Props) {
  return (
    <div
      className="landing-footer"
      style={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
      }}
    >
      <div className="landing-divider" />
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '11px',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.1em',
          margin: 0,
        }}
      >
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

      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.08em',
          margin: 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        {ROUTE_DOTS[activeDot]?.label ?? ''}
      </p>
    </div>
  );
}

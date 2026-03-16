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
          href="https://chicaron82.github.io/VN-Project/#who"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white/60 underline decoration-white/20 underline-offset-4 transition-colors duration-200"
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

      {/* Open-source attribution */}
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          color: 'rgba(255,255,255,0.12)',
          letterSpacing: '0.06em',
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Powered by{' '}
        <a href="https://project-osrm.org" target="_blank" rel="noopener noreferrer" className="hover:text-white/30 transition-colors">OSRM</a>
        {' · '}
        <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer" className="hover:text-white/30 transition-colors">Photon</a>
        {' · '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-white/30 transition-colors">OpenStreetMap</a>
        {' · '}
        <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/30 transition-colors">Open-Meteo</a>
        {' · '}
        <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer" className="hover:text-white/30 transition-colors">CARTO</a>
      </p>
    </div>
  );
}

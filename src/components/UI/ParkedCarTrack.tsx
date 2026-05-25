/** Parked car visual — shown when the journal is finalized or the trip is complete. */
export function ParkedCarTrack() {
  return (
    <div className="relative" style={{ height: 28 }}>
      <div className="absolute rounded-full" style={{ top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', background: 'linear-gradient(90deg, rgba(74,222,128,0.4), rgba(74,222,128,0.8))' }} />
      <div className="absolute rounded-full" style={{ top: '50%', left: 0, width: 8, height: 8, transform: 'translate(-50%, -50%)', background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.7)' }} />
      <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translate(50%, -60%)', fontSize: 18, filter: 'drop-shadow(0 2px 6px rgba(74,222,128,0.4))' }}>🚗</div>
      <div className="absolute rounded-full" style={{ top: '50%', right: 0, width: 10, height: 10, transform: 'translate(50%, -50%)', background: '#22c55e', boxShadow: '0 0 10px rgba(74,222,128,0.9)' }} />
    </div>
  );
}

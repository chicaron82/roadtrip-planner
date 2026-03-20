/**
 * VoilaLockIn — 800ms punctuation mark.
 *
 * The trip title appears large and centered over a dimmed map.
 * Auto-dismisses after 800ms (or on tap). Then onComplete fires.
 *
 * This is the moment the trip becomes real.
 *
 * 💚 My Experience Engine — The commitment beat
 */

import { useEffect, useRef } from 'react';

interface VoilaLockInProps {
  title: string;
  onComplete: () => void;
}

const HOLD_MS = 800;

export function VoilaLockIn({ title, onComplete }: VoilaLockInProps) {
  const dismissed = useRef(false);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    onComplete();
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, HOLD_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13, 13, 16, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: 'pointer',
        animation: 'lockInFadeIn 300ms ease forwards',
        padding: '0 40px',
        textAlign: 'center',
      }}
    >
      <style>{`
        @keyframes lockInFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <h2 style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: 'clamp(28px, 6vw, 52px)',
        fontWeight: 600,
        color: '#f5f0e8',
        lineHeight: 1.25,
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
    </div>
  );
}

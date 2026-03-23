/**
 * BeatProgressDots — Persistent (but barely-there) beat indicator.
 *
 * Four dots + connecting line. Always visible during the Four-Beat Arc
 * from Beat 2 onward. Current beat glows orange. Past beats cream.
 * Future beats dim. No labels. No chrome.
 *
 * 💚 My Experience Engine — Four-Beat Arc
 */

import { useEffect, useRef } from 'react';

interface BeatProgressDotsProps {
  currentBeat: 2 | 3 | 4;
}

const TRACK_WIDTH = 200;
const DOT_SIZE = 8;

/** Maps beat (1–4) to left px offset within the track. */
const beatToLeft = (beat: 1 | 2 | 3 | 4): number => ((beat - 1) / 3) * TRACK_WIDTH;

export function BeatProgressDots({ currentBeat }: BeatProgressDotsProps) {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bpd-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
        50%       { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0); }
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => { style.remove(); styleRef.current = null; };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: TRACK_WIDTH,
      height: DOT_SIZE,
      zIndex: 55,
      pointerEvents: 'none',
    }}>
      {/* Connecting line */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 1,
        background: 'rgba(255, 255, 255, 0.08)',
        transform: 'translateY(-50%)',
      }} />

      {/* Four dots */}
      {([1, 2, 3, 4] as const).map((beat) => {
        const isPast    = beat < currentBeat;
        const isCurrent = beat === currentBeat;

        return (
          <div
            key={beat}
            style={{
              position: 'absolute',
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: '50%',
              top: '50%',
              left: beatToLeft(beat),
              transform: 'translate(-50%, -50%)',
              background: isCurrent
                ? 'rgba(249, 115, 22, 0.85)'
                : isPast
                  ? 'rgba(245, 240, 232, 0.45)'
                  : 'rgba(255, 255, 255, 0.12)',
              animation: isCurrent ? 'bpd-pulse 2s ease-in-out infinite' : 'none',
              transition: 'background 300ms ease',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * BeatTransitionCar — Motion as punctuation between icebreaker beats.
 *
 * Mounts when a beat advances, drives the car emoji from one dot to the
 * next, then calls onComplete so the parent can unmount it.
 * Never persistent. Never chrome. Just a moment.
 *
 * 💚 My Experience Engine — Four-Beat Arc
 */

import { useEffect, useState } from 'react';

interface BeatTransitionCarProps {
  fromBeat: 1 | 2 | 3;
  toBeat:   2 | 3 | 4;
  onComplete: () => void;
}

type Phase = 'entering' | 'driving' | 'arrived' | 'exiting';

const TRACK_WIDTH = 200;
const DOT_SIZE    = 8;

/** Maps beat (1–4) to left px offset — identical to BeatProgressDots. */
const beatToLeft = (beat: 1 | 2 | 3 | 4): number => ((beat - 1) / 3) * TRACK_WIDTH;

export function BeatTransitionCar({ fromBeat, toBeat, onComplete }: BeatTransitionCarProps) {
  const [phase, setPhase] = useState<Phase>('entering');

  useEffect(() => {
    // entering (fade in 150ms) → driving (800ms) → arrived (hold 400ms) → exiting (200ms)
    const t1 = setTimeout(() => setPhase('driving'),  150);
    const t2 = setTimeout(() => setPhase('arrived'),  150 + 800);
    const t3 = setTimeout(() => setPhase('exiting'),  150 + 800 + 400);
    const t4 = setTimeout(() => onComplete(),         150 + 800 + 400 + 200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  // onComplete is stable (useCallback in parent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLeft = (phase === 'driving' || phase === 'arrived' || phase === 'exiting')
    ? beatToLeft(toBeat)
    : beatToLeft(fromBeat);

  const opacity = phase === 'entering' ? 0
    : phase === 'exiting'  ? 0
    : 1;

  const scale = phase === 'arrived' ? 1.2 : 1;

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: TRACK_WIDTH,
      height: DOT_SIZE,
      zIndex: 56,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: currentLeft,
        transform: `translate(-50%, -50%) scale(${scale})`,
        fontSize: 14,
        lineHeight: 1,
        opacity,
        transition: [
          `left 0.8s cubic-bezier(0.4, 0, 0.2, 1)`,
          `opacity ${phase === 'entering' ? '150ms' : '200ms'} ease`,
          `transform 150ms ease`,
        ].join(', '),
        userSelect: 'none',
      }}>
        🚗
      </div>
    </div>
  );
}

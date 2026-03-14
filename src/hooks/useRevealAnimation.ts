import { useState, useEffect, useRef } from 'react';

/**
 * useRevealAnimation — staggered layer reveal for the trip results screen.
 *
 * Detects the transition from no-trip → trip-calculated and phases in
 * three content layers at deliberate intervals:
 *
 *   Layer 1 (trip identity)  — 0 ms   — Signature Card
 *   Layer 2 (trip shape)     — 150 ms — Health + Viewer
 *   Layer 3 (next actions)   — 280 ms — Commit section
 *
 * If hasTrip is already true on mount (saved trip load), all layers
 * start visible — no animation, no flash.
 *
 * Resets immediately when hasTrip goes false (trip cleared or recalculating).
 */
export function useRevealAnimation(hasTrip: boolean): {
  layer1: boolean;
  layer2: boolean;
  layer3: boolean;
} {
  // Start fully revealed if a trip exists on mount (e.g. saved trip load).
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(() => (hasTrip ? 3 : 0));
  const prevHasTripRef = useRef(hasTrip);

  useEffect(() => {
    const was = prevHasTripRef.current;
    prevHasTripRef.current = hasTrip;

    if (!was && hasTrip) {
      // Fresh reveal — phase in layers sequentially.
      setPhase(1);
      const t2 = setTimeout(() => setPhase(2), 150);
      const t3 = setTimeout(() => setPhase(3), 280);
      return () => {
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    if (!hasTrip) {
      // Trip cleared — collapse immediately, ready for next reveal.
      setPhase(0);
    }
  }, [hasTrip]);

  return {
    layer1: phase >= 1,
    layer2: phase >= 2,
    layer3: phase >= 3,
  };
}

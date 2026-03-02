import { motion, useAnimation } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface SwipeableWizardProps {
  children: React.ReactNode;
  /** Pass the current trip mode. If not present (landing screen), disable swiping. */
  tripMode?: string | null;
  /** Called whenever the map-reveal state changes (mobile only). */
  onRevealChange?: (revealed: boolean) => void;
}

export function SwipeableWizard({ children, tripMode, onRevealChange }: SwipeableWizardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep a ref to the callback so stale closures inside touch event handlers always
  // call the latest version without needing to re-register the listeners.
  const onRevealChangeRef = useRef(onRevealChange);
  useEffect(() => { onRevealChangeRef.current = onRevealChange; }, [onRevealChange]);

  // Ref mirror of isRevealed so touch event callbacks (closed over stale state) always
  // read the current value without needing to be re-registered.
  const isRevealedRef = useRef(isRevealed);
  useEffect(() => { isRevealedRef.current = isRevealed; }, [isRevealed]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    let timeoutId: number;
    if (!tripMode) {
      timeoutId = window.setTimeout(() => {
        setIsRevealed(false);
        isRevealedRef.current = false;
        controls.set({ x: 0 });
        onRevealChangeRef.current?.(false);
      }, 0);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [tripMode, controls]);

  // Register touch listeners via addEventListener (not React synthetic events) so we can
  // use `passive: false` on touchmove and call e.preventDefault() only once we've confirmed
  // a horizontal swipe. This means:
  //   - Vertical scroll inside the wizard → works (we abort tracking, never prevent default)
  //   - Favourites bar pan-x → works (touch starts in [data-no-drag], we never track it)
  //   - Wizard swipe → works (we prevent default after locking horizontal, browser can't cancel us)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isMobile || !tripMode) return;

    let startX = 0, startY = 0, startTime = 0;
    let tracking = false;
    let lockedHorizontal = false;

    const snap = (reveal: boolean) => {
      setIsRevealed(reveal);
      isRevealedRef.current = reveal;
      controls.start({ x: reveal ? 'calc(-100% + 48px)' : 0 });
      onRevealChangeRef.current?.(reveal);
    };

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // If touch originates inside a no-drag zone, let the browser handle it completely
      if (target.closest('[data-no-drag="true"]')) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      tracking = true;
      lockedHorizontal = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!lockedHorizontal) {
        // Abort if clearly more vertical than horizontal — let vertical scroll through
        if (Math.abs(dy) > Math.abs(dx) + 8) {
          tracking = false;
          return;
        }
        // Not enough movement yet to determine direction
        if (Math.abs(dx) <= 8) return;
        // Confirmed horizontal — take ownership
        lockedHorizontal = true;
      }

      // Prevent browser from stealing the gesture (swipe-back nav, page scroll, etc.)
      e.preventDefault();

      const baseX = isRevealedRef.current ? -(window.innerWidth - 48) : 0;
      const rawX = baseX + dx;
      const min = -(window.innerWidth - 48);
      const clampedX =
        rawX > 0 ? rawX * 0.2
        : rawX < min ? min + (rawX - min) * 0.2
        : rawX;

      controls.set({ x: clampedX });
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const wasLocked = lockedHorizontal;
      tracking = false;
      lockedHorizontal = false;

      if (!wasLocked) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dt = Math.max((Date.now() - startTime) / 1000, 0.01);
      const velocity = dx / dt;

      if (dx < -80 || velocity < -400) snap(true);
      else if (dx > 80 || velocity > 400) snap(false);
      else controls.start({ x: isRevealedRef.current ? 'calc(-100% + 48px)' : 0 });
    };

    const onTouchCancel = () => { tracking = false; lockedHorizontal = false; };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false }); // non-passive so we can preventDefault
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [isMobile, tripMode, controls]);

  const toggleReveal = () => {
    const next = !isRevealedRef.current;
    setIsRevealed(next);
    isRevealedRef.current = next;
    controls.start({ x: next ? 'calc(-100% + 48px)' : 0 });
    onRevealChangeRef.current?.(next);
  };

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <motion.div
      ref={containerRef}
      className="absolute inset-x-0 inset-y-0 z-20 flex pointer-events-none w-full max-w-[100vw]"
      animate={controls}
      initial={{ x: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      // touchAction auto — we manage gestures ourselves via addEventListener above
    >
      <motion.div
        className={`flex-1 w-full h-full pointer-events-auto max-w-[100vw] relative ${tripMode ? 'pr-12' : ''}`}
        animate={{ opacity: isRevealed ? 0.35 : 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>

      {/* Drag handle / sliver to tap back in */}
      {tripMode && (
        <div
          onClick={toggleReveal}
          className="w-12 h-full absolute right-0 top-0 z-50 flex items-center justify-center cursor-ew-resize bg-black/10 hover:bg-black/20 active:bg-black/30 pointer-events-auto transition-colors"
        >
          <div className="w-1.5 h-16 bg-muted-foreground/30 rounded-full" />
        </div>
      )}
    </motion.div>
  );
}

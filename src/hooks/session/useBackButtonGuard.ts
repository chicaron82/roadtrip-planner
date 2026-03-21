/**
 * useBackButtonGuard — Intercepts Android hardware back button.
 *
 * Pushes a dummy history entry on mount and listens for popstate.
 * When back is pressed, re-pushes immediately (to re-arm) then calls
 * the provided handler to navigate within the app instead.
 *
 * Only active when `enabled` is true — caller controls when the guard
 * should be active based on app state.
 *
 * 💚 My Experience Engine
 */
import { useEffect } from 'react';

export function useBackButtonGuard(
  enabled: boolean,
  onBack: () => void,
): void {
  useEffect(() => {
    if (!enabled) return;

    // Push the guard entry so we have something to intercept
    window.history.pushState({ meeGuard: true }, '');

    const handler = (e: PopStateEvent) => {
      if (e.state?.meeGuard) {
        // Re-arm immediately so the next back press is also intercepted
        window.history.pushState({ meeGuard: true }, '');
        onBack();
      }
    };

    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [enabled, onBack]);
}

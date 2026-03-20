# Kitchen Ticket — Mar 19, 2026
## Android Back Button Guard

**Source:** Aaron — Android hardware back exits the site instead of navigating within the app
**New file:** `src/hooks/useBackButtonGuard.ts`
**Wired in:** `src/App.tsx`
**Confidence:** Medium — read App.tsx and useWizard fully before implementing. The popstate pattern is well-established but the wiring touches multiple state domains.

---

## The Problem

MEE is a single-page app. On Android, the hardware back button calls `window.history.back()`. Since MEE doesn't push history entries for screen transitions, there's nothing to go back to — the browser exits the site entirely.

This affects:
- Mid-icebreaker (back should go to previous question, not exit)
- Step 2 / Step 3 (back should go to Step 1, not exit)
- Active journal (back should warn before losing unsaved data)
- Four-Beat Arc screens (back should go to previous beat)

---

## How the Pattern Works

The browser's `popstate` event fires when Android back is pressed. You cannot fully prevent it, but you can immediately re-push a history entry to re-block, then handle the navigation internally.

```ts
// Push a "guard" entry on mount
window.history.pushState({ meeGuard: true }, '');

// On popstate — back was pressed
window.addEventListener('popstate', handler);

const handler = () => {
  // Re-push immediately to re-arm the guard
  window.history.pushState({ meeGuard: true }, '');
  // Then handle the internal navigation
  handleBack();
};
```

Each time back is pressed: the guard fires, re-pushes, and routes internally. The URL never actually changes. The browser never goes back.

---

## New File: `src/hooks/useBackButtonGuard.ts`

```ts
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

    // Push the guard entry
    window.history.pushState({ meeGuard: true }, '');

    const handler = (e: PopStateEvent) => {
      // Only intercept our own guard entries
      if (e.state?.meeGuard) {
        // Re-arm immediately
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
```

---

## App.tsx Wiring

Import the hook and define the back handler. Add near the other hooks (~L1 independent state section).

```ts
import { useBackButtonGuard } from './hooks/useBackButtonGuard';
```

**Define the back handler** (add to `useAppCallbacks` or inline in App.tsx — whichever keeps App under the line cap):

```ts
const handleBackPress = useCallback(() => {
  // Priority order — most specific state first

  // 1. Active journal — warn before losing data
  if (activeJournal && viewMode === 'journal') {
    // For now: exit journal mode back to plan view
    // Future: prompt "Stop journaling?" with confirmation
    setViewMode('plan');
    return;
  }

  // 2. Four-Beat Arc — go back a beat
  if (arc.beat === 3) {
    arc.enterSketch(locations, vehicle, settings); // returns to beat 2
    return;
  }
  if (arc.beat === 2) {
    arc.exitArc(); // back to landing
    return;
  }

  // 3. Icebreaker active — IcebreakerGate handles its own internal back
  // The icebreaker questions already have ← Back buttons.
  // Back button on Q1 = escape to landing.
  if (icebreaker.arcActive) {
    icebreaker.handleIcebreakerEscape(tripMode ?? 'plan');
    return;
  }

  // 4. Wizard Step 3 → Step 2, Step 2 → Step 1
  if (tripMode && planningStep === 3) {
    goToStep(2);
    return;
  }
  if (tripMode && planningStep === 2) {
    goToStep(1);
    return;
  }

  // 5. Step 1 / landing → nothing to do (already at root)
  // Don't exit — just do nothing. User is at the top of the stack.
}, [
  activeJournal, viewMode, setViewMode,
  arc, icebreaker, tripMode,
  planningStep, goToStep, locations, vehicle, settings,
]);
```

**Determine when the guard should be active:**

```ts
const backGuardActive = !!(
  tripMode ||           // in the wizard
  icebreaker.arcActive || // in icebreaker
  arc.beat              // in four-beat arc
);
```

**Register the hook:**

```ts
useBackButtonGuard(backGuardActive, handleBackPress);
```

---

## State Map — What Back Does

| Current State | Back Does |
|---------------|-----------|
| Landing screen | Nothing (guard off) |
| Icebreaker Q1 | Escape to landing |
| Icebreaker Q2/Q3 | Previous question (IcebreakerQuestion already has ← Back) |
| Four-Beat Arc Beat 2 | Exit arc → landing |
| Four-Beat Arc Beat 3 | Return to Beat 2 (sketch) |
| Four-Beat Arc Beat 4 | Nothing — let calculation complete |
| Wizard Step 1 | Nothing (already at root of wizard) |
| Wizard Step 2 | Step 1 |
| Wizard Step 3 | Step 2 |
| Journal mode (active) | Exit journal → plan view |
| Adventure Mode overlay | Close adventure mode |

---

## Confidence Check Notes

**Read before touching:**
- `src/App.tsx` fully — specifically the `arc` and `icebreaker` destructuring to get exact variable names
- `src/hooks/useFourBeatArc.ts` — confirm `enterSketch` is the right way to return to beat 2, or whether a dedicated `enterBeat2` should be added
- `src/components/Icebreaker/IcebreakerOrchestrator.tsx` — confirm `handleIcebreakerEscape` signature

**Potential issue:** `arc.enterSketch` requires locations, vehicle, settings — if any are stale at the time back is pressed, the sketch data will be wrong. Consider adding a dedicated `arc.returnToSketch()` that just calls `setBeat(2)` without recomputing. DiZee's call.

**Not in scope:** A "are you sure?" confirmation dialog on journal back. That's a follow-up ticket — the base guard ships first, the prompt comes after.

---

## Delivery Checklist

- [ ] `src/hooks/useBackButtonGuard.ts` — new hook
- [ ] `src/App.tsx` — import, `backGuardActive`, `handleBackPress`, `useBackButtonGuard` call
- [ ] Optionally: `src/hooks/useFourBeatArc.ts` — add `returnToSketch()` if `enterSketch` recompute is a concern

All files to `/mnt/user-data/outputs/` with original filenames.
No instructions. Working code only.

---

💚 My Experience Engine — Kitchen ticket by ZeeRah, Mar 19 2026

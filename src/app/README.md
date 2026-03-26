# App — Authority Layer

The `src/app/` directory is the **board pattern** — the authority layer that decides what the user sees and how the renderer behaves.

## Architecture

```
app-screen-policy.ts   →  Pure rules (no React, no hooks, no side effects)
useAppBoard.ts         →  React wrapper — reads hook state, applies policy, returns typed board
AppRenderer.tsx        →  Reads the board, renders the active surface
```

**Franchises own state. The board owns authority. The renderer owns presentation.**

## app-screen-policy.ts

Pure functions that answer "who wins?" questions. Zero React imports.

### `getActiveSurface(state) → ActiveSurface`

The single authoritative answer for what the main screen is.

Priority chain:
```
voila > templatePreview > journalAtAGlance > planning > icebreaker > landing
```

### `getOverlayState(state) → OverlayState`

What secondary layers are active on top of the main surface (share screen, adventure mode, icebreaker overlays).

### `getUIFlags(state) → UIFlags`

Derived booleans the renderer needs: should the planner shell mount? Should the background dim? Is the ghost car active? **No logic in JSX** — these flags are pre-computed here.

## useAppBoard.ts

React hook that reads from all the "franchise CEOs" (voila, planner, icebreaker, session, template loader) and produces a single `AppBoard` object:

```typescript
interface AppBoard {
  activeSurface: ActiveSurface;   // What screen to show
  overlayState: OverlayState;     // What layers sit on top
  uiFlags: UIFlags;               // Derived presentation booleans
  commands: AppBoardCommands;     // Clean command surface for the renderer
  // ... typed props bundles for each surface
}
```

The board bundles all props for each surface so the renderer doesn't need to know which hooks produced what. It just reads `board.voilaProps`, `board.plannerProps`, etc.

## AppRenderer.tsx

Reads `board.activeSurface` and renders the matching surface component. No decision logic — just a switch on the board's authority.

## Why This Pattern

Without it, App.tsx would need conditional rendering logic scattered through JSX:
```tsx
// ❌ Bad: decisions in JSX
{showVoila ? <Voila /> : pendingTemplate ? <Preview /> : tripMode ? <Planner /> : <Landing />}
```

With the board pattern, the renderer is dumb:
```tsx
// ✅ Good: renderer reads authority
<AppRenderer board={board} />
```

The rules live in a testable pure function (`app-screen-policy.ts`), not buried in JSX conditionals.

## Testing

`app-screen-policy.test.ts` — Tests the pure authority functions directly. No React rendering needed for policy logic.

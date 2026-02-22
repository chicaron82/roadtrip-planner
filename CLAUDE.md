# Roadtrip Planner — Claude Code Instructions

## Architecture Rules

### App.tsx is a Layout File — Hard Limit: 300 Lines

**App.tsx is NOT allowed to:**
- Define `useMemo` / `useCallback` inline
- Manage refs (except DOM layout refs like `sidebarScrollRef`)
- Handle events inline
- Contain business logic or computed state
- Coordinate feature-to-feature communication

**App.tsx IS allowed to:**
- Call hooks and destructure their results
- Render top-level layout structure
- Decide which top-level screen to show (landing vs. main)
- Pass state down to major section components

If something violates this, it goes in a hook or a controller — not App.tsx.

**This limit is enforced by ESLint (`max-lines: error` on `src/App.tsx`).
The build will fail if App.tsx exceeds 300 lines.**

---

### The 300-Line Limit (General)

All files should stay under 300 lines. If a file approaches this:
- Pause and ask "should this be split?"
- Default answer: yes
- Use the orchestrator pattern: thin parent + subdirectory modules

**Exceptions require explicit justification** (e.g. a pure renderer with many cases).

---

### New Feature Checklist

Before touching App.tsx for any new feature, answer:

1. Does this need a new hook? → create it in `src/hooks/`
2. Does this need event handlers? → create a controller in `src/components/` or a hook
3. Does this need computed/memoized state? → add to an existing hook

If all three are no, then and only then does it wire into App.tsx (and it should be minimal — a single prop pass or render line).

---

### The Wiring Decision Tree

```
Event listeners / handlers to add:
├─ 1-2 simple handlers → wire in App.tsx (acceptable)
├─ 3+ handlers → create dedicated hook or controller
├─ Complex state → create dedicated hook
└─ Needs cleanup/lifecycle → definitely create hook
```

---

### Feature Module Ownership

Each major feature should expose one clean interface to App.tsx:
- **One hook** (state + handlers)
- **One section component** (rendering)

App.tsx doesn't know a feature's internals. It composes features — it doesn't implement them.

Current major features:
- Planning wizard → `useWizard`
- Trip calculation → `useTripCalculation`
- POI discovery → `usePOI`
- Journal → `useJournal`

---

### No Props Explosion

If a component has more than ~10 props, stop and ask:
- Should some of these come from context?
- Should this component be split?
- Is this component doing too much?

`Step3Content` (21 props) is the current known offender — tracked for refactor.

---

## Build & Test

```bash
# Type check
npx tsc --noEmit

# Lint (App.tsx line count enforced here)
npx eslint src/

# Tests
npx vitest run

# Dev server
npm run dev
```

## Stack

- React 19 + TypeScript (strict mode)
- Vite + Tailwind CSS
- Leaflet / React Leaflet (maps)
- OSRM (routing), Photon/Nominatim (geocoding), Overpass (POI)
- Radix UI primitives
- Vitest + Testing Library

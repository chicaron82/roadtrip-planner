# Kitchen Ticket — Mar 16, 2026
**MEE — Settings Completion + Test Coverage + Doc Corrections**

---

## Context (Read First)

You're working on **My Experience Engine** (`myexperienceengine.com`) — a road trip planning app. React 19 + TypeScript strict mode, Vite, Tailwind, Zustand, Vitest.

**Key rules from CLAUDE.md:**
- All files stay under 330 lines. If approaching, split.
- New pure functions in `src/lib/` need a test in the same commit or a backlog entry.
- Never edit a file you haven't read in the current session.
- Full file outputs only — no partial diffs.

**Output files to:** `/mnt/user-data/outputs/` with the original filename, ready to drop in.

---

## Ticket 1 — BudgetProfilesSection (New File)

**What:** The Settings panel has 4 of 5 planned sections. `BudgetProfilesSection` is missing.

**Where it plugs in:** `src/components/Settings/SettingsPanel.tsx`

The panel already has this structure — read it before touching:
```
src/components/Settings/
  SettingsPanel.tsx       ← orchestrator, uses CollapsibleSection for each section
  MyDefaultsSection.tsx   ← units, currency, traveller defaults
  TravelStyleSection.tsx  ← hotel tier, gas price, meal price
  PrivacySection.tsx      ← clear history, reset profile, nuclear clear-all
  AboutSection.tsx        ← open source credits
```

**Storage layer is already built** — import from `../../lib/storage`:
```ts
getBudgetProfiles(): SavedBudgetProfile[]
removeBudgetProfile(id: string): SavedBudgetProfile[]
setDefaultBudgetProfile(id: string): void
```

**Type shape** (`src/types/core.ts`):
```ts
interface SavedBudgetProfile {
  id: string;
  name: string;           // "Solo Foodie Adventure"
  emoji: string;          // custom emoji
  baseProfile: BudgetProfile;   // 'balanced' | 'foodie' | 'scenic' | 'custom'
  weights: BudgetWeights;
  allocation: BudgetAllocation;
  defaultTotal?: number;
  numTravelers?: number;
  categoryLabels?: { misc?: string };
}
```

**What the section should do:**
- List saved budget profiles (name + emoji + baseProfile label)
- Let user set one as default (star/checkmark indicator)
- Let user delete profiles (with confirmation like PrivacySection's two-tap pattern)
- If no profiles: empty state — `"No saved profiles yet — save one from Step 3"`
- Read-only view here — saving happens in Step 3's `SaveProfileDialog`, not here

**Style:** Match the existing sections exactly. Dark zinc palette, `text-xs uppercase tracking-wide` labels, same button classes as PrivacySection.

**Wire it into SettingsPanel.tsx** inside the `CollapsibleSection` list, between TravelStyleSection and PrivacySection:
```tsx
import { Wallet } from 'lucide-react';  // or BookMarked — your call
<CollapsibleSection title="Budget Profiles" icon={<Wallet size={14} />}>
  <BudgetProfilesSection />
</CollapsibleSection>
```

**Deliver:** `BudgetProfilesSection.tsx` + updated `SettingsPanel.tsx`

---

## Ticket 2 — Settings Smoke Tests (New File)

**What:** Zero test coverage on the Settings panel. The clear-all path is the one that matters most — it calls `localStorage.clear()` and `window.location.reload()`.

**Create:** `src/components/Settings/PrivacySection.test.tsx`

**What to test:**
1. Renders without crashing
2. Shows correct trip history count from `getHistory()`
3. "Clear" button on trip history calls `clearHistory()`
4. Clear-all button first render: shows "Clear all" (not "Confirm?")
5. First click on clear-all: shows "Confirm?" (two-tap gate)
6. Second click: calls `localStorage.clear()` and `window.location.reload()`
7. Cancel link resets back to "Clear all"
8. "Reset" profile button calls `clearUserProfile()`

**Mock pattern to follow** — look at how other tests in `src/hooks/` mock storage:
```ts
vi.mock('../../lib/storage', () => ({
  getHistory: vi.fn(),
  clearHistory: vi.fn(),
}));
vi.mock('../../lib/user-profile', () => ({
  clearUserProfile: vi.fn(),
}));
```

`localStorage.clear` and `window.location.reload` need to be mocked in jsdom — check `src/test/setup.ts` first to see if there's a pattern already, then:
```ts
vi.spyOn(window.location, 'reload').mockImplementation(() => {});
vi.spyOn(Storage.prototype, 'clear');
```

**Deliver:** `PrivacySection.test.tsx`

---

## Ticket 3 — Doc Corrections (Two Files)

### FEATURES.md — Two wrong lines

**File:** `docs/FEATURES.md`

Find and fix:
```
WRONG:  | Vitest + Testing Library | 678 tests across 40 test files |
RIGHT:  | Vitest + Testing Library | 1,997+ assertions across 105 test files |

WRONG:  | OpenWeatherMap | Weather per segment endpoint |
RIGHT:  | Open-Meteo | Weather forecasts per segment endpoint |
```

### backlog.md — Mark completed items

**File:** `docs/backlog.md`

At the top of these two sections, add a closure note:

**Wave 4 section** — add after the heading:
```
> **✅ Closed Mar 2026.** 15 component test files now exist covering Health,
> Itinerary, Journal, Viewer, and StepHelpers. Wave 4 is complete.
```

**Step UX — Collapsible Sections section** — add after the heading:
```
> **✅ Closed Mar 2026.** `CollapsibleSection` component built and wired into
> Step 1 (arrival target, round-trip mode) and Step 2 (Travelers, Accommodation,
> Driving prefs, Trip style). BudgetProfilesSection in Settings is the remaining
> open item from this surface.
```

**Settings Panel section** — add after the heading:
```
> **⚠️ Partially closed Mar 2026.** 4 of 5 sections shipped: MyDefaults,
> TravelStyle, Privacy, About. BudgetProfilesSection outstanding — see kitchen
> ticket Mar 16.
```

**Deliver:** updated `FEATURES.md` + updated `backlog.md`

---

## Delivery Checklist

- [ ] `BudgetProfilesSection.tsx` — new file, under 330 lines
- [ ] `SettingsPanel.tsx` — updated to include BudgetProfilesSection
- [ ] `PrivacySection.test.tsx` — smoke tests for the destructive paths
- [ ] `FEATURES.md` — two line corrections
- [ ] `backlog.md` — three closure notes added

All files to `/mnt/user-data/outputs/` with original filenames.

No instructions. Working code only.

# Kitchen Ticket — Mar 18, 2026
## Wiring Gaps + Test Coverage Additions

**Source:** ZeeRah codebase audit — wiring verification + test quality review
**Status:** Ready to cook
**Confidence required:** Read each file before touching. Multiple systems involved.

---

## PART 1 — WIRING GAPS (features not fully connected)

---

### Ticket 1.1 — Fork Lineage Not Written on Export
**Priority:** P0 — two lines, high impact

**The gap:** `buildTemplateLineage()` exists in `src/lib/url.ts`, is tested, is never called in production. Every exported template is generation 0 forever regardless of fork history.

**Files to touch:**
- `src/lib/journal-export.ts` — two export functions need the fix

**In `exportJournalAsTemplate()`**, the template object currently has no `lineage` field. Add:
```ts
// At top of function, after reading journal:
import { buildTemplateLineage } from './url';

// In the template object:
lineage: journal.origin?.type === 'template' && journal.origin.id
  ? buildTemplateLineage({ templateId: journal.origin.id, lineage: undefined, title: '', author: '', description: '', recommendations: undefined })
  : undefined,
id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
```

**In `exportTripAsTemplate()`**, the template object already has an `id` field. Add lineage from loaded template meta if available. The `printInput` doesn't carry lineage — this one may need `templateMeta?: TemplateImportResult['meta']` as an optional prop, or read from a store value if one exists.

**⚠️ Confidence check before cooking:** Read `exportTripAsTemplate` fully. Determine whether template meta is accessible at call sites (`TripBottomActions`, `Step3CommitSection`). If not accessible without prop drilling, wire the simpler fix first (`exportJournalAsTemplate` only) and note the limitation.

**Done when:**
- Exported journal templates include `lineage` array when trip was originally imported from a template
- `exportTripAsTemplate` includes lineage when called after a template import

---

### Ticket 1.2 — POI Dismiss Is Session-Only
**Priority:** P1

**The gap:** `dismissPOI` in `usePOISuggestions.ts` writes to `useState` only. Dismissed POIs come back on page refresh.

**File:** `src/hooks/usePOISuggestions.ts`

**Fix:** Persist dismissed POI IDs to localStorage.

```ts
const DISMISSED_KEY = 'mee-dismissed-pois';

// On mount: load persisted dismissed IDs
const [poiActions, setPoiActions] = useState<Record<string, 'added' | 'dismissed'>>(() => {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      return Object.fromEntries(ids.map(id => [id, 'dismissed' as const]));
    }
  } catch { /* ignore */ }
  return {};
});

// In dismissPOI callback: also persist
const dismissPOI = useCallback((poiId: string) => {
  setPoiActions(prev => {
    const next = { ...prev, [poiId]: 'dismissed' as const };
    try {
      const dismissedIds = Object.entries(next)
        .filter(([, action]) => action === 'dismissed')
        .map(([id]) => id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds));
    } catch { /* ignore */ }
    return next;
  });
}, []);
```

**Clear on reset:** Add `localStorage.removeItem(DISMISSED_KEY)` to `resetPOIs` callback.

**Done when:** Dismissed POIs stay dismissed after page refresh.

---

### Ticket 1.3 — Template Recommendations Not Displayed on Import
**Priority:** P1

**The gap:** When importing a template, `recommendations` (per-stop author tips) parse correctly and are stored in `TemplateImportResult['meta'].recommendations`. Nothing displays them to the user.

**Where to surface:** Step 1, after template import — when locations are pre-filled from a template, show a collapsible "Tips from the original author" card beneath the location list.

**Data path:**
- `parseSharedTemplate()` → `TemplateImportResult.meta.recommendations`
- `useTripLoader.handleImportTemplate` sets `tripOrigin` from meta
- `meta.recommendations` is available at the point `handleImportTemplate` fires

**New component:** `src/components/Trip/StepHelpers/TemplateRecommendations.tsx`

Simple collapsible. Reads from `templateMeta` (needs to be stored somewhere accessible — either passed through or stored in Zustand alongside `tripOrigin`).

```
Tips from the original author
▼
📍 Thunder Bay — "Best poutine is at Hoito Restaurant on Bay St."
📍 Sault Ste Marie — "Stop at Agawa Canyon if you have time. Worth the detour."
[star] [no star] rating shown per stop
```

**⚠️ Confidence check:** Read `useTripLoader.ts` fully. Determine whether `meta.recommendations` is currently accessible after import completes, or whether it gets dropped. If dropped, store it in Zustand alongside `tripOrigin`.

**Done when:** After loading a template that has recommendations, Step 1 shows a collapsible author tips card.

---

### Ticket 1.4 — Adaptive Profile Not Visible in Settings
**Priority:** P2

**The gap:** `user-profile.ts` tracks hotel/meal averages across trips with recency-weighted decay. `getAdaptiveDefaults()` is called and applied silently. The Settings panel has no UI to show what MEE has learned.

**File:** `src/components/Settings/MyDefaultsSection.tsx`

Add a section at the bottom of MyDefaultsSection:

```
What MEE has learned from your trips

Based on your last 4 trips:
  Average hotel: ~$142/night
  Average daily spend: ~$68/person

[ Use these as my defaults ]   [ Reset to baseline ]
```

Only show when `isAdaptiveMeaningful(getAdaptiveDefaults())` returns true (requires 3+ trips).

Import: `getAdaptiveDefaults`, `isAdaptiveMeaningful`, `ADAPTIVE_CONFIDENCE_THRESHOLD` from `../../lib/user-profile`.

**Done when:** Settings → My Defaults shows learned averages after 3+ trips, with a "Use these" button that applies them.

---

## PART 2 — TEST COVERAGE ADDITIONS

---

### Ticket 2.1 — `useFourBeatArc` Tests (New File)
**Priority:** P0 — new state machine, zero coverage

**Create:** `src/hooks/useFourBeatArc.test.ts`

The hook is pure state management — no React context, no API calls. Use `renderHook` from `@testing-library/react`.

**Required test cases:**

```
Initial state
✓ beat is null, isBuilding false, isRevealing false, sketchData null

enterSketch()
✓ with valid origin + destination → beat becomes 2, sketchData populated
✓ sketchData.distanceKm > 0 (haversine × 1.25 applied)
✓ sketchData.estimate is not null
✓ with missing origin → beat stays null (guard condition)
✓ with missing destination → beat stays null

enterWorkshop()
✓ beat 2 → beat 3
✓ sketchData preserved

startCalculation()
✓ beat becomes 4
✓ isBuilding becomes true

onBuildComplete()
✓ isBuilding becomes false
✓ isRevealing becomes true

onRevealComplete()
✓ isRevealing becomes false
✓ beat becomes null

exitArc()
✓ beat null, isBuilding false, isRevealing false, sketchData null
✓ can be called from any beat (beat 2, 3, 4 all reset cleanly)

State machine integrity
✓ enterWorkshop() from beat null → beat stays null (no-op, no crash)
✓ onBuildComplete() before startCalculation → isRevealing true but beat still set (edge case)
```

**Fixtures needed:**
```ts
const ORIGIN: Location = { id: 'wpg', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' };
const DEST: Location = { id: 'tor', name: 'Toronto', lat: 43.6532, lng: -79.3832, type: 'destination' };
```

---

### Ticket 2.2 — `costPerPerson` Fix Locked In
**Priority:** P0 — bug fix with no regression test

**Files to update:**

**`src/lib/trip-orchestrator/orchestrator-integration.test.ts`**

The mock summary has:
```ts
costPerPerson: 24,   // ← stale: this was fuel-only (old bug)
```

With `numTravelers: 2` and `COST_BREAKDOWN.total`, update to assert:
```ts
// costPerPerson should be costBreakdown.total / numTravelers
// Read the actual COST_BREAKDOWN.total value first, then set:
costPerPerson: COST_BREAKDOWN.total / 2,  // not fuel-only
```

**Add a new explicit test:**
```ts
it('costPerPerson uses full trip cost, not fuel only', () => {
  // numTravelers: 2, total cost $200 → costPerPerson should be $100 not $24
  expect(result.costPerPerson).toBe(result.costBreakdown!.total / 2);
  expect(result.costPerPerson).not.toBe(result.totalFuelCost / 2);
});
```

**`src/hooks/useTripCalculation.test.ts`**

Update mock fixture:
```ts
costPerPerson: 12,    // ← stale: matches fuel-only calculation
costBreakdown: { fuel: 24, accommodation: 0, meals: 0, misc: 0, total: 24, perPerson: 12 },
```
This fixture happens to be consistent (total === fuel === 24, so total/2 === fuel/2 === 12). Not wrong, but misleading. Add a comment: `// total: 24 here because mock has no hotel/food/misc — in real trips total >> fuel`.

---

### Ticket 2.3 — `journal-export` Tests (New File)
**Priority:** P1 — 405 lines, zero tests, lineage gap lives here

**Create:** `src/lib/journal-export.test.ts`

Focus on the functions that have real logic, not the DOM-touching download functions (those need integration tests, not unit tests).

**What to test:**

```
exportTripAsTemplate (logic only — mock the download side)
✓ Produces type: 'roadtrip-template'
✓ Has a stable id field
✓ route.origin and route.destination populated from printInput locations
✓ settings fields present and correctly mapped
✓ When lineage fix is applied: lineage array written correctly

exportJournalAsTemplate (logic only)
✓ recommendations array populated from journal entries with ratings
✓ recommendations filtered to only entries with rating or isHighlight
✓ author set from travelers[0] when available
✓ When lineage fix is applied: lineage written when journal.origin.type === 'template'

Template round-trip
✓ exportTripAsTemplate output passes validateSharedTemplate with zero errors
✓ parseSharedTemplate can read back what exportTripAsTemplate wrote
```

**Mock the download side:**
```ts
vi.spyOn(document, 'createElement').mockReturnValue({
  href: '', download: '', click: vi.fn(), style: {}
} as unknown as HTMLAnchorElement);
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
```

---

### Ticket 2.4 — `useIcebreakerGate` Tests (New File)
**Priority:** P1 — batching trap must have a regression test

**Create:** `src/hooks/useIcebreakerGate.test.ts`

**Critical test — the batching trap:**
```ts
it('uses setTripMode (not selectTripMode) on completion — preserves prefill', () => {
  // selectTripMode calls resetTripSession which wipes locations
  // setTripMode does not reset — prefill must survive
  const { result } = renderHook(() => useIcebreakerGate({...}));
  act(() => result.current.handleIcebreakerComplete('plan', mockPrefill));
  expect(mockSetTripMode).toHaveBeenCalledWith('plan');
  expect(mockSelectTripMode).not.toHaveBeenCalled();
  expect(mockSetLocations).toHaveBeenCalled(); // prefill applied
});

it('uses selectTripMode on escape — clean slate correct', () => {
  const { result } = renderHook(() => useIcebreakerGate({...}));
  act(() => result.current.handleIcebreakerEscape('plan'));
  expect(mockSelectTripMode).toHaveBeenCalledWith('plan');
  expect(mockSetLocations).not.toHaveBeenCalled(); // no prefill on escape
});
```

**Other cases:**
```
✓ handleLandingSelect with 'classic' pref → selectTripMode, no icebreaker
✓ handleLandingSelect with null pref (first-timer) → sets icebreakerMode
✓ handleLandingSelect with 'conversational' pref → sets icebreakerMode
✓ estimateWorkshopActive set on estimate mode completion
✓ adventureInitialValues populated on adventure completion
```

---

### Ticket 2.5 — `useCalculationMessages` Tests (New File)
**Priority:** P2

**Create:** `src/hooks/useCalculationMessages.test.ts`

**Critical test — the voice split:**
```ts
it('uses MEE-forward voice for icebreaker users', () => {
  const { result } = renderHook(() =>
    useCalculationMessages(true, locations, true) // icebreakerOrigin=true
  );
  expect(result.current).toMatch(/MEE is mapping/i);
});

it('uses classic voice for non-icebreaker users', () => {
  const { result } = renderHook(() =>
    useCalculationMessages(true, locations, false) // icebreakerOrigin=false
  );
  expect(result.current).toMatch(/Routing from/i);
});

it('returns null when not calculating', () => {
  const { result } = renderHook(() =>
    useCalculationMessages(false, locations, false)
  );
  expect(result.current).toBeNull();
});
```

---

### Ticket 2.6 — Split-By-Days Submodule Tests
**Priority:** P2

**Create:** `src/lib/budget/split-by-days-round-trip.test.ts`

The round-trip submodule is 208 lines and handles the stay-day calculation. This is where the estimate bug from the shopping cart session lived (nights vs days off-by-one).

**Key cases:**
```
✓ Round trip with 3 destination stay days: returnDate correctly places 3 free days at destination
✓ Round trip with 0 stay days: drives straight back with no destination free days
✓ Off-by-one check: Jul 1→Jul 5 trip generates 5 calendar days, not 4 nights
✓ Return leg generates same driving days as outbound leg
```

---

## Delivery Checklist

- [ ] `src/lib/journal-export.ts` — lineage written in both export functions (Ticket 1.1)
- [ ] `src/hooks/usePOISuggestions.ts` — dismiss persists to localStorage (Ticket 1.2)
- [ ] `src/components/Trip/StepHelpers/TemplateRecommendations.tsx` — new component (Ticket 1.3)
- [ ] `src/components/Settings/MyDefaultsSection.tsx` — adaptive profile surface (Ticket 1.4)
- [ ] `src/hooks/useFourBeatArc.test.ts` — new, full state machine coverage (Ticket 2.1)
- [ ] `src/lib/trip-orchestrator/orchestrator-integration.test.ts` — stale fixture updated (Ticket 2.2)
- [ ] `src/lib/journal-export.test.ts` — new, export pipeline coverage (Ticket 2.3)
- [ ] `src/hooks/useIcebreakerGate.test.ts` — new, batching trap regression (Ticket 2.4)
- [ ] `src/hooks/useCalculationMessages.test.ts` — new, voice split locked in (Ticket 2.5)
- [ ] `src/lib/budget/split-by-days-round-trip.test.ts` — new, round-trip edge cases (Ticket 2.6)

All files to `/mnt/user-data/outputs/` with original filenames.
No instructions. Working code only.

---

💚 My Experience Engine — Kitchen ticket by ZeeRah, Mar 18 2026

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getBudgetProfiles,
  saveBudgetProfile,
  removeBudgetProfile,
  setDefaultBudgetProfile,
  getLastTripBudget,
} from './storage-budget';
import type { SavedBudgetProfile } from '../types';

// ─── Real in-memory localStorage (global setup.ts replaces it with a mock) ────

const _store = new Map<string, string>();
const workingLocalStorage: Storage = {
  getItem: (k: string) => _store.get(k) ?? null,
  setItem: (k: string, v: string) => { _store.set(k, v); },
  removeItem: (k: string) => { _store.delete(k); },
  clear: () => { _store.clear(); },
  get length() { return _store.size; },
  key: (i: number) => [..._store.keys()][i] ?? null,
};

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', { value: workingLocalStorage, configurable: true });
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<SavedBudgetProfile> = {}): SavedBudgetProfile {
  return {
    id: 'profile-001',
    name: 'Solo Adventurer',
    emoji: '🏕️',
    baseProfile: 'scenic',
    weights: { gas: 30, hotel: 35, food: 25, misc: 10 },
    allocation: 'flexible',
    stats: { timesUsed: 0 },
    ...overrides,
  };
}

beforeEach(() => {
  _store.clear();
});

// ─── getBudgetProfiles ─────────────────────────────────────────────────────────

describe('getBudgetProfiles', () => {
  it('returns an empty array on fresh storage', () => {
    expect(getBudgetProfiles()).toEqual([]);
  });

  it('returns saved profiles after saving', () => {
    saveBudgetProfile(makeProfile());
    const profiles = getBudgetProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('profile-001');
  });
});

// ─── saveBudgetProfile ─────────────────────────────────────────────────────────

describe('saveBudgetProfile', () => {
  it('adds a new profile to empty storage', () => {
    const result = saveBudgetProfile(makeProfile());
    expect(result).toHaveLength(1);
  });

  it('does not duplicate — updates existing profile with same id', () => {
    saveBudgetProfile(makeProfile({ name: 'Original' }));
    saveBudgetProfile(makeProfile({ name: 'Updated' }));
    const profiles = getBudgetProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Updated');
  });

  it('adds multiple distinct profiles', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    saveBudgetProfile(makeProfile({ id: 'profile-002', name: 'Foodie Budget' }));
    expect(getBudgetProfiles()).toHaveLength(2);
  });

  it('sets lastUsed to an ISO timestamp on save', () => {
    saveBudgetProfile(makeProfile());
    const saved = getBudgetProfiles()[0];
    expect(saved.lastUsed).toBeDefined();
    expect(() => new Date(saved.lastUsed!)).not.toThrow();
  });

  it('increments timesUsed for a newly added profile', () => {
    saveBudgetProfile(makeProfile({ stats: { timesUsed: 0 } }));
    const saved = getBudgetProfiles()[0];
    expect(saved.stats!.timesUsed).toBe(1);
  });

  it('does NOT increment timesUsed for an existing profile being updated', () => {
    saveBudgetProfile(makeProfile({ stats: { timesUsed: 5 } }));
    saveBudgetProfile(makeProfile({ name: 'Updated Name', stats: { timesUsed: 5 } }));
    const saved = getBudgetProfiles()[0];
    expect(saved.stats!.timesUsed).toBe(5); // stays at 5, no increment on update
  });

  it('returns the full updated profiles array', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    const result = saveBudgetProfile(makeProfile({ id: 'profile-002', name: 'P2' }));
    expect(result).toHaveLength(2);
  });
});

// ─── removeBudgetProfile ──────────────────────────────────────────────────────

describe('removeBudgetProfile', () => {
  it('removes a profile by id', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    saveBudgetProfile(makeProfile({ id: 'profile-002', name: 'P2' }));
    removeBudgetProfile('profile-001');
    const profiles = getBudgetProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('profile-002');
  });

  it('returns the updated profiles array after removal', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    const result = removeBudgetProfile('profile-001');
    expect(result).toHaveLength(0);
  });

  it('is a no-op when id does not exist', () => {
    saveBudgetProfile(makeProfile());
    removeBudgetProfile('nonexistent');
    expect(getBudgetProfiles()).toHaveLength(1);
  });

  it('clears the default profile id from localStorage when the default is removed', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    setDefaultBudgetProfile('profile-001');
    removeBudgetProfile('profile-001');
    // Default key should be gone — localStorage.getItem returns null
    expect(_store.get('roadtrip_default_budget_id')).toBeUndefined();
  });

  it('does NOT clear default if a different profile is removed', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    saveBudgetProfile(makeProfile({ id: 'profile-002', name: 'P2' }));
    setDefaultBudgetProfile('profile-001');
    removeBudgetProfile('profile-002');
    expect(_store.get('roadtrip_default_budget_id')).toBe('profile-001');
  });
});

// ─── setDefaultBudgetProfile ──────────────────────────────────────────────────

describe('setDefaultBudgetProfile', () => {
  it('marks the correct profile as isDefault', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    saveBudgetProfile(makeProfile({ id: 'profile-002', name: 'P2' }));
    setDefaultBudgetProfile('profile-001');
    const profiles = getBudgetProfiles();
    expect(profiles.find(p => p.id === 'profile-001')!.isDefault).toBe(true);
    expect(profiles.find(p => p.id === 'profile-002')!.isDefault).toBe(false);
  });

  it('changes the default when called again with a different id', () => {
    saveBudgetProfile(makeProfile({ id: 'profile-001' }));
    saveBudgetProfile(makeProfile({ id: 'profile-002', name: 'P2' }));
    setDefaultBudgetProfile('profile-001');
    setDefaultBudgetProfile('profile-002');
    const profiles = getBudgetProfiles();
    expect(profiles.find(p => p.id === 'profile-001')!.isDefault).toBe(false);
    expect(profiles.find(p => p.id === 'profile-002')!.isDefault).toBe(true);
    expect(_store.get('roadtrip_default_budget_id')).toBe('profile-002');
  });
});

// ─── getLastTripBudget ────────────────────────────────────────────────────────

describe('getLastTripBudget', () => {
  it('returns null when no last trip has been stored', () => {
    expect(getLastTripBudget()).toBeNull();
  });

  it('returns the stored last trip budget when present', () => {
    const lastTrip = {
      tripName: 'Winnipeg → Banff',
      tripDate: '2026-07-15T00:00:00.000Z',
      numTravelers: 2,
      budget: {
        mode: 'plan-to-budget' as const,
        allocation: 'flexible' as const,
        profile: 'scenic' as const,
        weights: { gas: 30, hotel: 35, food: 25, misc: 10 },
        gas: 300, hotel: 700, food: 500, misc: 200, total: 1700,
      },
    };
    _store.set('roadtrip_last_trip_budget', JSON.stringify(lastTrip));
    const result = getLastTripBudget();
    expect(result).not.toBeNull();
    expect(result!.tripName).toBe('Winnipeg → Banff');
    expect(result!.numTravelers).toBe(2);
  });

  it('returns null when stored value is malformed JSON', () => {
    _store.set('roadtrip_last_trip_budget', 'not-valid-json{{{');
    expect(getLastTripBudget()).toBeNull();
  });
});

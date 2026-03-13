import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getGarage,
  saveToGarage,
  removeFromGarage,
  getDefaultVehicleId,
  setDefaultVehicleId,
  getDefaultVehicle,
  type SavedVehicle,
} from './storage-garage';

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

function makeVehicle(overrides: Partial<SavedVehicle> = {}): SavedVehicle {
  return {
    id: 'v-001',
    name: 'Test Truck',
    year: '2022',
    make: 'Toyota',
    model: 'Tacoma',
    fuelEconomyCity: 11.5,
    fuelEconomyHwy: 9.8,
    tankSize: 73,
    ...overrides,
  };
}

beforeEach(() => {
  _store.clear();
});

// ─── getGarage ─────────────────────────────────────────────────────────────────

describe('getGarage', () => {
  it('returns an empty array on fresh storage', () => {
    expect(getGarage()).toEqual([]);
  });

  it('returns stored vehicles after saving', () => {
    const v = makeVehicle();
    saveToGarage(v);
    const garage = getGarage();
    expect(garage).toHaveLength(1);
    expect(garage[0].id).toBe('v-001');
  });
});

// ─── saveToGarage ─────────────────────────────────────────────────────────────

describe('saveToGarage', () => {
  it('adds a new vehicle to an empty garage', () => {
    const garage = saveToGarage(makeVehicle());
    expect(garage).toHaveLength(1);
  });

  it('does not duplicate — updates existing vehicle with same id', () => {
    saveToGarage(makeVehicle({ name: 'Original' }));
    saveToGarage(makeVehicle({ name: 'Updated' }));
    const garage = getGarage();
    expect(garage).toHaveLength(1);
    expect(garage[0].name).toBe('Updated');
  });

  it('adds multiple distinct vehicles', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    expect(getGarage()).toHaveLength(2);
  });

  it('sets lastUsed to an ISO timestamp on save', () => {
    saveToGarage(makeVehicle());
    const saved = getGarage()[0];
    expect(saved.lastUsed).toBeDefined();
    expect(() => new Date(saved.lastUsed!)).not.toThrow();
  });

  it('returns the full updated garage array', () => {
    const result = saveToGarage(makeVehicle({ id: 'v-001' }));
    saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    // saveToGarage on v-002 should return array with both
    const result2 = saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    expect(result2).toHaveLength(2);
    // First call returns single-item array (only v-001 was there)
    expect(result).toHaveLength(1);
  });
});

// ─── removeFromGarage ─────────────────────────────────────────────────────────

describe('removeFromGarage', () => {
  it('removes a vehicle by id', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    removeFromGarage('v-001');
    const garage = getGarage();
    expect(garage).toHaveLength(1);
    expect(garage[0].id).toBe('v-002');
  });

  it('returns the updated garage after removal', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    const result = removeFromGarage('v-001');
    expect(result).toHaveLength(0);
  });

  it('is a no-op when id does not exist', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    removeFromGarage('nonexistent');
    expect(getGarage()).toHaveLength(1);
  });

  it('works on an empty garage without throwing', () => {
    expect(() => removeFromGarage('v-001')).not.toThrow();
  });
});

// ─── getDefaultVehicleId ──────────────────────────────────────────────────────

describe('getDefaultVehicleId', () => {
  it('returns null when no default has been set', () => {
    expect(getDefaultVehicleId()).toBeNull();
  });

  it('returns the id after setDefaultVehicleId is called', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    setDefaultVehicleId('v-001');
    expect(getDefaultVehicleId()).toBe('v-001');
  });
});

// ─── setDefaultVehicleId ──────────────────────────────────────────────────────

describe('setDefaultVehicleId', () => {
  it('marks the correct vehicle as isDefault in the garage', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    setDefaultVehicleId('v-001');
    const garage = getGarage();
    expect(garage.find(v => v.id === 'v-001')!.isDefault).toBe(true);
    expect(garage.find(v => v.id === 'v-002')!.isDefault).toBe(false);
  });

  it('changes the default when called again with a different id', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    setDefaultVehicleId('v-001');
    setDefaultVehicleId('v-002');
    expect(getDefaultVehicleId()).toBe('v-002');
    const garage = getGarage();
    expect(garage.find(v => v.id === 'v-002')!.isDefault).toBe(true);
    expect(garage.find(v => v.id === 'v-001')!.isDefault).toBe(false);
  });
});

// ─── getDefaultVehicle ────────────────────────────────────────────────────────

describe('getDefaultVehicle', () => {
  it('returns null when garage is empty', () => {
    expect(getDefaultVehicle()).toBeNull();
  });

  it('returns the vehicle matching the default id', () => {
    saveToGarage(makeVehicle({ id: 'v-001', name: 'Truck' }));
    saveToGarage(makeVehicle({ id: 'v-002', name: 'Sedan' }));
    setDefaultVehicleId('v-002');
    expect(getDefaultVehicle()!.id).toBe('v-002');
  });

  it('falls back to most recently used vehicle when no default id set', () => {
    // Write directly with fixed timestamps so saveToGarage doesn't overwrite lastUsed
    const garage = [
      makeVehicle({ id: 'v-001', name: 'Old Car', lastUsed: '2024-01-01T00:00:00.000Z' }),
      makeVehicle({ id: 'v-002', name: 'New Car', lastUsed: '2025-06-01T00:00:00.000Z' }),
    ];
    _store.set('roadtrip_garage', JSON.stringify(garage));
    expect(getDefaultVehicle()!.id).toBe('v-002');
  });

  it('falls back to the only vehicle when garage has one entry and no default', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    expect(getDefaultVehicle()!.id).toBe('v-001');
  });

  it('returns null when defaultId set but vehicle has been removed', () => {
    saveToGarage(makeVehicle({ id: 'v-001' }));
    setDefaultVehicleId('v-001');
    removeFromGarage('v-001');
    // Default id still in localStorage but vehicle gone — falls back to most recent (none)
    expect(getDefaultVehicle()).toBeNull();
  });
});

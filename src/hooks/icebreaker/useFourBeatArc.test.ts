/**
 * useFourBeatArc — State machine tests
 *
 * Pure state transitions with no network, no context, no API calls.
 * renderHook + act covers the full state machine.
 *
 * 💚 My Experience Engine
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFourBeatArc } from './useFourBeatArc';
import type { Location, Vehicle, TripSettings } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORIGIN: Location = {
  id: 'wpg', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin',
};
const DEST: Location = {
  id: 'tor', name: 'Thunder Bay', lat: 48.3809, lng: -89.2477, type: 'destination',
};
const VEHICLE: Vehicle = {
  year: '2022', make: 'Toyota', model: 'Camry',
  fuelEconomyCity: 10, fuelEconomyHwy: 8, tankSize: 50,
};
const SETTINGS = {
  units: 'metric',
  currency: 'CAD',
  numTravelers: 1,
  numDrivers: 1,
  maxDriveHours: 8,
  gasPrice: 1.65,
  hotelPricePerNight: 140,
  mealPricePerDay: 50,
  budgetMode: 'open',
  budget: { mode: 'open', allocation: 'flexible', profile: 'balanced', weights: { gas: 25, hotel: 35, food: 30, misc: 10 }, gas: 0, hotel: 0, food: 0, misc: 0, total: 0 },
  departureDate: '',
  departureTime: '09:00',
  returnDate: '',
  arrivalDate: '',
  arrivalTime: '',
} as TripSettings;

// ── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('beat is null, isBuilding false, isRevealing false, sketchData null', () => {
    const { result } = renderHook(() => useFourBeatArc());
    expect(result.current.beat).toBeNull();
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.isRevealing).toBe(false);
    expect(result.current.sketchData).toBeNull();
  });
});

// ── enterSketch ───────────────────────────────────────────────────────────────

describe('enterSketch()', () => {
  it('sets beat to 2 and populates sketchData with valid origin + destination', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    expect(result.current.beat).toBe(2);
    expect(result.current.sketchData).not.toBeNull();
  });

  it('sketchData.distanceKm > 0 (haversine × road factor applied)', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    expect(result.current.sketchData!.distanceKm).toBeGreaterThan(0);
  });

  it('sketchData.estimate is not null', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    expect(result.current.sketchData!.estimate).toBeDefined();
  });

  it('sketchData carries origin and destination names', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    expect(result.current.sketchData!.originName).toBe('Winnipeg');
    expect(result.current.sketchData!.destinationName).toBe('Thunder Bay');
  });

  it('beat stays null when origin is missing', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([DEST], VEHICLE, SETTINGS); });
    expect(result.current.beat).toBeNull();
  });

  it('beat stays null when destination is missing', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN], VEHICLE, SETTINGS); });
    expect(result.current.beat).toBeNull();
  });

  it('beat stays null when origin has zero coords', () => {
    const { result } = renderHook(() => useFourBeatArc());
    const zeroOrigin = { ...ORIGIN, lat: 0, lng: 0 };
    act(() => { result.current.enterSketch([zeroOrigin, DEST], VEHICLE, SETTINGS); });
    expect(result.current.beat).toBeNull();
  });
});

// ── enterWorkshop ─────────────────────────────────────────────────────────────

describe('enterWorkshop()', () => {
  it('advances beat 2 → beat 3', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.enterWorkshop(); });
    expect(result.current.beat).toBe(3);
  });

  it('preserves sketchData when advancing to beat 3', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.enterWorkshop(); });
    expect(result.current.sketchData).not.toBeNull();
  });

  it('is a no-op when called from beat null (guard)', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterWorkshop(); });
    expect(result.current.beat).toBeNull();
  });
});

// ── startCalculation ──────────────────────────────────────────────────────────

describe('startCalculation()', () => {
  it('sets beat to 4', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    expect(result.current.beat).toBe(4);
  });

  it('sets isBuilding to true', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    expect(result.current.isBuilding).toBe(true);
  });
});

// ── onBuildComplete ───────────────────────────────────────────────────────────

describe('onBuildComplete()', () => {
  it('sets isBuilding to false', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    act(() => { result.current.onBuildComplete(); });
    expect(result.current.isBuilding).toBe(false);
  });

  it('sets isRevealing to true', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    act(() => { result.current.onBuildComplete(); });
    expect(result.current.isRevealing).toBe(true);
  });
});

// ── onRevealComplete ──────────────────────────────────────────────────────────

describe('onRevealComplete()', () => {
  it('sets isRevealing to false', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    act(() => { result.current.onBuildComplete(); });
    act(() => { result.current.onRevealComplete(); });
    expect(result.current.isRevealing).toBe(false);
  });

  it('sets beat back to null', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    act(() => { result.current.onBuildComplete(); });
    act(() => { result.current.onRevealComplete(); });
    expect(result.current.beat).toBeNull();
  });
});

// ── exitArc ───────────────────────────────────────────────────────────────────

describe('exitArc()', () => {
  it('resets all state to initial from beat 2', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.exitArc(); });
    expect(result.current.beat).toBeNull();
    expect(result.current.isBuilding).toBe(false);
    expect(result.current.isRevealing).toBe(false);
    expect(result.current.sketchData).toBeNull();
  });

  it('resets all state from beat 3', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.enterWorkshop(); });
    act(() => { result.current.exitArc(); });
    expect(result.current.beat).toBeNull();
    expect(result.current.sketchData).toBeNull();
  });

  it('resets all state from beat 4 (mid-build)', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    act(() => { result.current.startCalculation(); });
    act(() => { result.current.exitArc(); });
    expect(result.current.beat).toBeNull();
    expect(result.current.isBuilding).toBe(false);
  });
});

// ── State machine integrity ───────────────────────────────────────────────────

describe('state machine integrity', () => {
  it('full arc: beat null → 2 → 3 → 4 → null', () => {
    const { result } = renderHook(() => useFourBeatArc());
    expect(result.current.beat).toBeNull();
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    expect(result.current.beat).toBe(2);
    act(() => { result.current.enterWorkshop(); });
    expect(result.current.beat).toBe(3);
    act(() => { result.current.startCalculation(); });
    expect(result.current.beat).toBe(4);
    act(() => { result.current.onBuildComplete(); });
    act(() => { result.current.onRevealComplete(); });
    expect(result.current.beat).toBeNull();
  });

  it('onBuildComplete before startCalculation sets isRevealing without crashing', () => {
    const { result } = renderHook(() => useFourBeatArc());
    act(() => { result.current.enterSketch([ORIGIN, DEST], VEHICLE, SETTINGS); });
    // Edge case: skip startCalculation, call onBuildComplete directly
    act(() => { result.current.onBuildComplete(); });
    expect(result.current.isRevealing).toBe(true);
    expect(result.current.beat).toBe(2); // beat stays wherever it was
  });
});

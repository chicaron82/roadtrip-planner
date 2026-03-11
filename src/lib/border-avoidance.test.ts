import { describe, expect, it } from 'vitest';
import type { Location } from '../types';
import {
  isNorthwesternOntarioSouthDetour,
  shouldTryLakeSuperiorCorridor,
} from './border-avoidance';

const REGINA: Location = {
  id: 'regina',
  name: 'Regina, SK',
  lat: 50.4452,
  lng: -104.6189,
  type: 'origin',
};

const THUNDER_BAY: Location = {
  id: 'thunder-bay',
  name: 'Thunder Bay, ON',
  lat: 48.3822,
  lng: -89.2461,
  type: 'destination',
};

const WINNIPEG: Location = {
  id: 'winnipeg',
  name: 'Winnipeg, MB',
  lat: 49.8951,
  lng: -97.1384,
  type: 'origin',
};

describe('northwestern Ontario corridor detection', () => {
  it('flags the southern detour corridor used by the problematic Regina route', () => {
    const geometry: [number, number][] = [
      [50.445, -104.619],
      [49.975, -98.383],
      [49.779, -97.150],
      [48.931, -95.333],
      [48.691, -94.447],
      [48.606, -93.403],
      [48.743, -92.324],
      [48.667, -91.091],
      [48.589, -89.858],
      [48.382, -89.246],
    ];

    expect(isNorthwesternOntarioSouthDetour(geometry)).toBe(true);
    expect(shouldTryLakeSuperiorCorridor([REGINA, THUNDER_BAY], geometry)).toBe(true);
  });

  it('does not flag the normal Kenora/Dryden corridor', () => {
    const geometry: [number, number][] = [
      [49.895, -97.138],
      [49.656, -96.229],
      [49.722, -94.913],
      [49.802, -94.408],
      [49.818, -93.998],
      [49.855, -93.369],
      [49.585, -92.356],
      [49.343, -91.478],
      [49.051, -90.474],
      [48.534, -89.649],
      [48.382, -89.246],
    ];

    expect(isNorthwesternOntarioSouthDetour(geometry)).toBe(false);
    expect(shouldTryLakeSuperiorCorridor([WINNIPEG, THUNDER_BAY], geometry)).toBe(false);
  });

  it('ignores trips outside the prairie to northwestern Ontario corridor', () => {
    const geometry: [number, number][] = [
      [43.653, -79.383],
      [44.231, -76.486],
      [45.421, -75.697],
    ];

    expect(shouldTryLakeSuperiorCorridor([
      { id: 'tor', name: 'Toronto, ON', lat: 43.653, lng: -79.383, type: 'origin' },
      { id: 'ott', name: 'Ottawa, ON', lat: 45.421, lng: -75.697, type: 'destination' },
    ], geometry)).toBe(false);
  });
});
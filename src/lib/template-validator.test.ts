import { describe, it, expect } from 'vitest';
import { validateSharedTemplate, sanitizeSharedTemplate, CURRENT_TEMPLATE_VERSION } from './template-validator';
import type { SharedTemplate } from './url';

// ==================== HELPERS ====================

function makeValidTemplate(overrides: Partial<SharedTemplate> = {}): SharedTemplate {
  return {
    type: 'roadtrip-template',
    version: CURRENT_TEMPLATE_VERSION,
    author: 'Test Author',
    trip: {
      title: 'Winnipeg to Toronto',
      description: 'A great road trip',
      tags: ['scenic', 'family'],
      durationDays: 3,
      totalDistanceKm: 2100,
      totalDurationHours: '22h',
    },
    route: {
      origin: { id: 'o1', name: 'Winnipeg, MB', lat: 49.8951, lng: -97.1384, type: 'origin' },
      destination: { id: 'd1', name: 'Toronto, ON', lat: 43.6532, lng: -79.3832, type: 'destination' },
      waypoints: [],
    },
    ...overrides,
  };
}

// ==================== VALID TEMPLATE ====================

describe('validateSharedTemplate — valid', () => {
  it('passes a well-formed template', () => {
    const result = validateSharedTemplate(makeValidTemplate());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts unknown version with a warning (not error)', () => {
    const result = validateSharedTemplate(makeValidTemplate({ version: '99' }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('Unknown template version'))).toBe(true);
  });

  it('accepts template with valid settings block', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      settings: { maxDriveHours: 8, numTravelers: 4, numDrivers: 2, gasPrice: 1.50 },
    }));
    expect(result.valid).toBe(true);
  });

  it('accepts template with budget block and matching totals', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      budget: {
        profile: 'balanced',
        totalSpent: 1000,
        perPerson: 250,
        breakdown: { fuel: 300, accommodation: 400, food: 200, misc: 100 },
      },
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings.filter(w => w.includes('Budget breakdown'))).toHaveLength(0);
  });

  it('accepts template with waypoints', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      route: {
        origin: { id: 'o', name: 'Winnipeg', lat: 49.89, lng: -97.13, type: 'origin' },
        destination: { id: 'd', name: 'Toronto', lat: 43.65, lng: -79.38, type: 'destination' },
        waypoints: [{ id: 'w1', name: 'Thunder Bay', lat: 48.38, lng: -89.24, type: 'waypoint' }],
      },
    }));
    expect(result.valid).toBe(true);
  });
});

// ==================== TYPE ERRORS ====================

describe('validateSharedTemplate — type errors', () => {
  it('rejects non-object input', () => {
    expect(validateSharedTemplate(null).valid).toBe(false);
    expect(validateSharedTemplate('string').valid).toBe(false);
    expect(validateSharedTemplate([]).valid).toBe(false);
    expect(validateSharedTemplate(42).valid).toBe(false);
  });

  it('rejects wrong type field', () => {
    const result = validateSharedTemplate({ ...makeValidTemplate(), type: 'wrong' } as unknown);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected 'roadtrip-template'");
  });

  it('rejects missing route', () => {
    const { route: _r, ...noRoute } = makeValidTemplate();
    const result = validateSharedTemplate(noRoute);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Missing or invalid route'))).toBe(true);
  });

  it('rejects invalid origin (missing lat/lng)', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      route: {
        origin: { id: 'o', name: 'Winnipeg', lat: NaN, lng: -97, type: 'origin' },
        destination: { id: 'd', name: 'Toronto', lat: 43.65, lng: -79.38, type: 'destination' },
        waypoints: [],
      },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('route.origin'))).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      route: {
        origin: { id: 'o', name: 'Winnipeg', lat: 999, lng: -97, type: 'origin' },
        destination: { id: 'd', name: 'Toronto', lat: 43.65, lng: -79.38, type: 'destination' },
        waypoints: [],
      },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('out-of-range'))).toBe(true);
  });

  it('rejects missing trip metadata', () => {
    const { trip: _t, ...noTrip } = makeValidTemplate();
    const result = validateSharedTemplate(noTrip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('trip metadata'))).toBe(true);
  });

  it('rejects negative settings values', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      settings: { gasPrice: -1.5 },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('negative'))).toBe(true);
  });

  it('rejects NaN in settings numeric fields', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      settings: { maxDriveHours: NaN },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('maxDriveHours'))).toBe(true);
  });
});

// ==================== WARNINGS ====================

describe('validateSharedTemplate — warnings', () => {
  it('warns when version is missing', () => {
    const { version: _v, ...noVersion } = makeValidTemplate();
    const result = validateSharedTemplate(noVersion);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('version field'))).toBe(true);
  });

  it('warns when trip title is empty', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      trip: { ...makeValidTemplate().trip, title: '   ' },
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('title'))).toBe(true);
  });

  it('warns when budget breakdown does not match totalSpent', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      budget: {
        profile: 'balanced',
        totalSpent: 500,
        perPerson: 125,
        breakdown: { fuel: 300, accommodation: 400, food: 200, misc: 100 }, // sum=1000 ≠ 500
      },
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('Budget breakdown'))).toBe(true);
  });

  it('warns when numDrivers exceeds numTravelers', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      settings: { numDrivers: 5, numTravelers: 2 },
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('numDrivers'))).toBe(true);
  });

  it('warns when a waypoint has invalid coords', () => {
    const result = validateSharedTemplate(makeValidTemplate({
      route: {
        origin: { id: 'o', name: 'Winnipeg', lat: 49.89, lng: -97.13, type: 'origin' },
        destination: { id: 'd', name: 'Toronto', lat: 43.65, lng: -79.38, type: 'destination' },
        waypoints: [{ id: 'bad', name: 'Broken', lat: NaN, lng: 0, type: 'waypoint' }],
      },
    }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('waypoints[0]'))).toBe(true);
  });
});

// ==================== SANITIZER ====================

describe('sanitizeSharedTemplate', () => {
  it('trims whitespace from strings', () => {
    const tpl = makeValidTemplate({ author: '  DiZee  ' });
    tpl.trip.title = '  My Trip  ';
    const sanitized = sanitizeSharedTemplate(tpl);
    expect(sanitized.author).toBe('DiZee');
    expect(sanitized.trip.title).toBe('My Trip');
  });

  it('truncates strings to max length', () => {
    const tpl = makeValidTemplate({ author: 'A'.repeat(300) });
    const sanitized = sanitizeSharedTemplate(tpl);
    expect(sanitized.author.length).toBe(200);
  });

  it('clears empty tags', () => {
    const tpl = makeValidTemplate();
    tpl.trip.tags = ['scenic', '  ', 'family'];
    const sanitized = sanitizeSharedTemplate(tpl);
    expect(sanitized.trip.tags).toEqual(['scenic', 'family']);
  });

  it('sanitizes waypoint names', () => {
    const tpl = makeValidTemplate({
      route: {
        origin: { id: 'o', name: '  Winnipeg  ', lat: 49.89, lng: -97.13, type: 'origin' },
        destination: { id: 'd', name: ' Toronto ', lat: 43.65, lng: -79.38, type: 'destination' },
        waypoints: [{ id: 'w', name: '  Thunder Bay  ', lat: 48.38, lng: -89.24, type: 'waypoint' }],
      },
    });
    const sanitized = sanitizeSharedTemplate(tpl);
    expect(sanitized.route.origin.name).toBe('Winnipeg');
    expect(sanitized.route.destination.name).toBe('Toronto');
    expect(sanitized.route.waypoints[0].name).toBe('Thunder Bay');
  });
});

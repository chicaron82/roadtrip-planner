import { describe, it, expect } from 'vitest';
import {
  convertMpgToL100km,
  convertL100kmToMpg,
  convertLitresToGallons,
  convertGallonsToLitres,
  formatDistance,
  formatDuration,
  formatCurrency,
  calculateTripCosts,
  calculateArrivalTimes,
  STOP_DURATIONS,
  getDayNumber,
} from './calculations';
import type { RouteSegment, Vehicle, TripSettings } from '../types';
import { DEFAULT_BUDGET } from './budget';

// ==================== UNIT CONVERSION TESTS ====================

describe('Unit Conversions', () => {
  describe('convertMpgToL100km', () => {
    it('converts MPG to L/100km correctly', () => {
      // 30 MPG ≈ 7.84 L/100km
      expect(convertMpgToL100km(30)).toBeCloseTo(7.84, 1);
    });

    it('handles high MPG values', () => {
      // 50 MPG ≈ 4.70 L/100km
      expect(convertMpgToL100km(50)).toBeCloseTo(4.70, 1);
    });

    it('handles low MPG values', () => {
      // 15 MPG ≈ 15.68 L/100km
      expect(convertMpgToL100km(15)).toBeCloseTo(15.68, 1);
    });

    it('returns 0 for 0 MPG', () => {
      expect(convertMpgToL100km(0)).toBe(0);
    });
  });

  describe('convertL100kmToMpg', () => {
    it('converts L/100km to MPG correctly', () => {
      // 8 L/100km ≈ 29.4 MPG
      expect(convertL100kmToMpg(8)).toBeCloseTo(29.4, 1);
    });

    it('is inverse of convertMpgToL100km', () => {
      const mpg = 30;
      const l100km = convertMpgToL100km(mpg);
      expect(convertL100kmToMpg(l100km)).toBeCloseTo(mpg, 1);
    });

    it('returns 0 for 0 L/100km', () => {
      expect(convertL100kmToMpg(0)).toBe(0);
    });
  });

  describe('convertLitresToGallons', () => {
    it('converts litres to gallons correctly', () => {
      // 3.78541 L = 1 gallon
      expect(convertLitresToGallons(3.78541)).toBeCloseTo(1, 2);
    });

    it('converts larger values', () => {
      expect(convertLitresToGallons(60)).toBeCloseTo(15.85, 1);
    });
  });

  describe('convertGallonsToLitres', () => {
    it('converts gallons to litres correctly', () => {
      expect(convertGallonsToLitres(1)).toBeCloseTo(3.785, 2);
    });

    it('is inverse of convertLitresToGallons', () => {
      const litres = 50;
      const gallons = convertLitresToGallons(litres);
      expect(convertGallonsToLitres(gallons)).toBeCloseTo(litres, 1);
    });
  });
});

// ==================== FORMATTING TESTS ====================

describe('Formatting Functions', () => {
  describe('formatDistance', () => {
    it('formats metric distances', () => {
      expect(formatDistance(100, 'metric')).toBe('100.0 km');
      expect(formatDistance(573.8, 'metric')).toBe('573.8 km');
    });

    it('formats imperial distances', () => {
      expect(formatDistance(100, 'imperial')).toBe('62.1 mi');
      // 573.8 km / 1.60934 = 356.52... - rounding may vary
      const result = formatDistance(573.8, 'imperial');
      expect(result).toMatch(/356\.[56] mi/);
    });
  });

  describe('formatDuration', () => {
    it('formats minutes only', () => {
      expect(formatDuration(45)).toBe('45 min');
    });

    it('formats hours only', () => {
      expect(formatDuration(120)).toBe('2h');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(150)).toBe('2h 30m');
      expect(formatDuration(375)).toBe('6h 15m');
    });

    it('handles zero minutes', () => {
      expect(formatDuration(0)).toBe('0 min');
    });
  });

  describe('formatCurrency', () => {
    it('formats CAD correctly', () => {
      const result = formatCurrency(150.5, 'CAD');
      expect(result).toContain('150.50');
      expect(result).toContain('$');
    });

    it('formats USD correctly', () => {
      const result = formatCurrency(150.5, 'USD');
      expect(result).toContain('150.50');
    });
  });
});

// ==================== TRIP COST CALCULATION TESTS ====================

describe('calculateTripCosts', () => {
  const mockVehicle: Vehicle = {
    year: '2024',
    make: 'Toyota',
    model: 'Camry',
    fuelEconomyCity: 8.7, // L/100km
    fuelEconomyHwy: 6.2,  // L/100km
    tankSize: 60, // litres
  };

  const mockSettings: TripSettings = {
    units: 'metric',
    currency: 'CAD',
    maxDriveHours: 8,
    numTravelers: 2,
    numDrivers: 1,
    budgetMode: 'open',
    budget: DEFAULT_BUDGET,
    departureDate: '2024-08-16',
    departureTime: '09:00',
    arrivalDate: '',
    arrivalTime: '',
    useArrivalTime: false,
    gasPrice: 1.50,
    hotelPricePerNight: 150,
    mealPricePerDay: 50,
    isRoundTrip: false,
    avoidTolls: false,
    avoidBorders: false,
    scenicMode: false,
    routePreference: 'fastest',
    stopFrequency: 'balanced',
    tripPreferences: [],
  };

  const mockSegments: RouteSegment[] = [
    {
      from: { id: 'origin', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' },
      to: { id: 'dest', name: 'Regina', lat: 50.4452, lng: -104.6189, type: 'destination' },
      distanceKm: 573.8,
      durationMinutes: 365, // ~6 hours
      fuelNeededLitres: 0,
      fuelCost: 0,
    },
  ];

  it('calculates total distance correctly', () => {
    const result = calculateTripCosts(mockSegments, mockVehicle, mockSettings);
    expect(result.totalDistanceKm).toBe(573.8);
  });

  it('calculates total duration correctly', () => {
    const result = calculateTripCosts(mockSegments, mockVehicle, mockSettings);
    expect(result.totalDurationMinutes).toBe(365);
  });

  it('calculates fuel consumption with weighted economy (80% hwy, 20% city)', () => {
    const result = calculateTripCosts(mockSegments, mockVehicle, mockSettings);
    // Weighted economy: 6.2 * 0.8 + 8.7 * 0.2 = 4.96 + 1.74 = 6.7 L/100km
    // Fuel needed: 573.8 / 100 * 6.7 = 38.44 L
    expect(result.totalFuelLitres).toBeCloseTo(38.44, 1);
  });

  it('calculates fuel cost correctly', () => {
    const result = calculateTripCosts(mockSegments, mockVehicle, mockSettings);
    // Fuel cost: ~38.44 L * $1.50 = ~$57.66
    expect(result.totalFuelCost).toBeCloseTo(57.66, 0);
  });

  it('calculates cost per person', () => {
    const result = calculateTripCosts(mockSegments, mockVehicle, mockSettings);
    // With 2 travelers: ~$57.66 / 2 = ~$28.83
    expect(result.costPerPerson).toBeCloseTo(result.totalFuelCost / 2, 1);
  });

  it('calculates driving days based on max hours', () => {
    const result = calculateTripCosts(mockSegments, mockVehicle, mockSettings);
    // 365 minutes = 6.08 hours, max 8 hours/day = 1 day
    expect(result.drivingDays).toBe(1);
  });

  it('calculates multiple driving days for long trips', () => {
    const longSegments: RouteSegment[] = [
      {
        from: { id: 'origin', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' },
        to: { id: 'dest', name: 'Toronto', lat: 43.6532, lng: -79.3832, type: 'destination' },
        distanceKm: 2200,
        durationMinutes: 1200, // 20 hours
        fuelNeededLitres: 0,
        fuelCost: 0,
      },
    ];
    const result = calculateTripCosts(longSegments, mockVehicle, mockSettings);
    // 1200 minutes = 20 hours, max 8 hours/day = 3 days
    expect(result.drivingDays).toBe(3);
  });

  it('calculates gas stops based on tank capacity', () => {
    const longSegments: RouteSegment[] = [
      {
        from: { id: 'origin', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' },
        to: { id: 'dest', name: 'Toronto', lat: 43.6532, lng: -79.3832, type: 'destination' },
        distanceKm: 2200,
        durationMinutes: 1200,
        fuelNeededLitres: 0,
        fuelCost: 0,
      },
    ];
    const result = calculateTripCosts(longSegments, mockVehicle, mockSettings);
    // Range: 60L tank * 0.75 usable / 6.7 L/100km * 100 = ~672 km
    // 2200km trip needs ~2-3 stops
    expect(result.gasStops).toBeGreaterThanOrEqual(2);
    expect(result.gasStops).toBeLessThanOrEqual(4);
  });

  it('handles imperial units', () => {
    const imperialSettings = {
      ...mockSettings,
      units: 'imperial' as const,
    };
    const imperialVehicle = {
      ...mockVehicle,
      fuelEconomyCity: 27, // MPG
      fuelEconomyHwy: 38, // MPG
      tankSize: 15.85, // gallons
    };
    const result = calculateTripCosts(mockSegments, imperialVehicle, imperialSettings);
    expect(result.totalDistanceKm).toBe(573.8);
    expect(result.totalFuelLitres).toBeGreaterThan(0);
  });
});

// ==================== ARRIVAL TIME CALCULATION TESTS ====================

describe('calculateArrivalTimes', () => {
  const mockSegments: RouteSegment[] = [
    {
      from: { id: 'origin', name: 'Winnipeg', lat: 49.8951, lng: -97.1384, type: 'origin' },
      to: { id: 'mid', name: 'Portage', lat: 49.9728, lng: -98.2925, type: 'waypoint' },
      distanceKm: 100,
      durationMinutes: 60,
      fuelNeededLitres: 0,
      fuelCost: 0,
    },
    {
      from: { id: 'mid', name: 'Portage', lat: 49.9728, lng: -98.2925, type: 'waypoint' },
      to: { id: 'dest', name: 'Brandon', lat: 49.8485, lng: -99.9501, type: 'destination' },
      distanceKm: 130,
      durationMinutes: 80,
      fuelNeededLitres: 0,
      fuelCost: 0,
    },
  ];

  it('sets departure time for first segment', () => {
    const result = calculateArrivalTimes(mockSegments, '2024-08-16', '09:00');
    // The departure time should contain the correct local time (09:00)
    // The exact ISO string varies by timezone, so we check the Date object
    const departureDate = new Date(result[0].departureTime!);
    expect(departureDate.getHours()).toBe(9);
    expect(departureDate.getMinutes()).toBe(0);
  });

  it('calculates arrival time based on duration', () => {
    const result = calculateArrivalTimes(mockSegments, '2024-08-16', '09:00');
    // First segment: 60 minutes, arrives at 10:00
    const arrivalTime = new Date(result[0].arrivalTime!);
    expect(arrivalTime.getHours()).toBe(10);
    expect(arrivalTime.getMinutes()).toBe(0);
  });

  it('chains segment times correctly', () => {
    const result = calculateArrivalTimes(mockSegments, '2024-08-16', '09:00');
    // Second segment departs when first arrives (no stop)
    const firstArrival = new Date(result[0].arrivalTime!);
    const secondDeparture = new Date(result[1].departureTime!);
    expect(firstArrival.getTime()).toBe(secondDeparture.getTime());
  });

  it('adds stop duration between segments', () => {
    const segmentsWithStop: RouteSegment[] = [
      {
        ...mockSegments[0],
        stopType: 'meal',
      },
      mockSegments[1],
    ];
    const result = calculateArrivalTimes(segmentsWithStop, '2024-08-16', '09:00');

    // First segment arrives at 10:00, meal stop is 60 min, second departs at 11:00
    const firstArrival = new Date(result[0].arrivalTime!);
    const secondDeparture = new Date(result[1].departureTime!);

    const stopDuration = (secondDeparture.getTime() - firstArrival.getTime()) / 60000;
    expect(stopDuration).toBe(STOP_DURATIONS.meal);
  });

  it('handles overnight stops', () => {
    const segmentsWithOvernight: RouteSegment[] = [
      {
        ...mockSegments[0],
        stopType: 'overnight',
      },
      mockSegments[1],
    ];
    const result = calculateArrivalTimes(segmentsWithOvernight, '2024-08-16', '09:00');

    const firstArrival = new Date(result[0].arrivalTime!);
    const secondDeparture = new Date(result[1].departureTime!);

    const stopDuration = (secondDeparture.getTime() - firstArrival.getTime()) / 60000;
    expect(stopDuration).toBe(STOP_DURATIONS.overnight); // 12 hours
  });

  it('returns empty array for empty segments', () => {
    const result = calculateArrivalTimes([], '2024-08-16', '09:00');
    expect(result).toEqual([]);
  });
});

// ==================== DAY NUMBER TESTS ====================

describe('getDayNumber', () => {
  it('returns 1 for same day', () => {
    expect(getDayNumber('2024-08-16', '2024-08-16')).toBe(1);
  });

  it('returns 2 for next day', () => {
    expect(getDayNumber('2024-08-16', '2024-08-17')).toBe(2);
  });

  it('handles week spans', () => {
    expect(getDayNumber('2024-08-16', '2024-08-23')).toBe(8);
  });
});

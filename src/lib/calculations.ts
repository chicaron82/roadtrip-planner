import type { RouteSegment, TripSummary, Vehicle, TripSettings } from '../types';
import { analyzeSegments } from './segment-analyzer';

export function calculateTripCosts(
  uniqueSegments: RouteSegment[],
  vehicle: Vehicle,
  settings: TripSettings
): TripSummary {
  const totalDistanceKm = uniqueSegments.reduce((acc, seg) => acc + seg.distanceKm, 0);
  const totalDurationMinutes = uniqueSegments.reduce((acc, seg) => acc + seg.durationMinutes, 0);

  // Weighted fuel economy (80% highway, 20% city for highway driving assumption)
  const weightedFuelEconomy =
    settings.units === 'metric'
      ? vehicle.fuelEconomyHwy * 0.8 + vehicle.fuelEconomyCity * 0.2
      : convertMpgToL100km(vehicle.fuelEconomyHwy) * 0.8 +
        convertMpgToL100km(vehicle.fuelEconomyCity) * 0.2;

  const totalFuelLitres = (totalDistanceKm / 100) * weightedFuelEconomy;
  const totalFuelCost = totalFuelLitres * settings.gasPrice;

  const tankSizeLitres =
    settings.units === 'metric' ? vehicle.tankSize : vehicle.tankSize * 3.78541;

  // Gas stops: (Total Fuel Needed / (75% of Tank Capacity)) - 1 (assumes starting full)
  // Using 75% as a safe usable capacity buffer
  const gasStops = Math.max(
    0,
    Math.ceil(totalFuelLitres / (tankSizeLitres * 0.75)) - 1
  );

  const costPerPerson =
    settings.numTravelers > 0 ? totalFuelCost / settings.numTravelers : totalFuelCost;

  const drivingDays = Math.ceil(
    totalDurationMinutes / 60 / settings.maxDriveHours
  );
  
  // Calculate per-segment costs
  const segmentsWithCost = uniqueSegments.map(segment => ({
      ...segment,
      fuelNeededLitres: (segment.distanceKm / 100) * weightedFuelEconomy,
      fuelCost: ((segment.distanceKm / 100) * weightedFuelEconomy) * settings.gasPrice
  }));

  // Analyze segments for warnings, timezone crossings, etc.
  const analyzedSegments = analyzeSegments(segmentsWithCost, settings);

  // Apply Round Trip Logic (x2)
  const multiplier = settings.isRoundTrip ? 2 : 1;

  return {
    totalDistanceKm: totalDistanceKm * multiplier,
    totalDurationMinutes: totalDurationMinutes * multiplier,
    totalFuelLitres: totalFuelLitres * multiplier,
    totalFuelCost: totalFuelCost * multiplier,
    gasStops: gasStops * multiplier, // Rough estimate, might need precise tank logic but x2 is safe
    costPerPerson: costPerPerson * multiplier,
    drivingDays: drivingDays * multiplier,
    segments: analyzedSegments, // Segments with intelligence (warnings, timezone, etc.)
    fullGeometry: []
  };
}

export function convertMpgToL100km(mpg: number): number {
  if (mpg === 0) return 0;
  return 235.215 / mpg;
}

export function convertL100kmToMpg(l100km: number): number {
  if (l100km === 0) return 0;
  return 235.215 / l100km;
}

export function formatDistance(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    return `${(km * 0.621371).toFixed(1)} mi`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatCurrency(amount: number, currency: 'CAD' | 'USD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function convertLitresToGallons(litres: number): number {
  return litres / 3.78541;
}

export function convertGallonsToLitres(gallons: number): number {
  return gallons * 3.78541;
}

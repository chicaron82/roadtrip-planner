import type { RouteSegment, TripSettings } from '../types';

/**
 * Validate trip inputs before any expensive calculation runs.
 * Returns an array of human-readable error strings.
 * An empty array means all checks passed.
 */
export function validateTripInputs(
  segments: RouteSegment[],
  settings: TripSettings,
): string[] {
  const errors: string[] = [];

  if (!segments || segments.length === 0) {
    errors.push('No route segments — please add at least two locations.');
  }

  if (isNaN(settings.maxDriveHours) || settings.maxDriveHours <= 0) {
    errors.push('Max drive hours must be a positive number.');
  }

  if (!Number.isInteger(settings.numTravelers) || settings.numTravelers < 1) {
    errors.push('At least 1 traveler is required.');
  }

  if (!Number.isInteger(settings.numDrivers) || settings.numDrivers < 1) {
    errors.push('At least 1 driver is required.');
  }

  if (settings.numDrivers > settings.numTravelers) {
    errors.push('Number of drivers cannot exceed number of travelers.');
  }

  if (settings.budget.total < 0) {
    errors.push('Budget total cannot be negative.');
  }

  // Detect NaN segments that would silently corrupt calculations
  const badSegments = segments.filter(
    s => isNaN(s.distanceKm) || isNaN(s.durationMinutes),
  );
  if (badSegments.length > 0) {
    errors.push(`${badSegments.length} route segment(s) have invalid distance or duration values.`);
  }

  return errors;
}

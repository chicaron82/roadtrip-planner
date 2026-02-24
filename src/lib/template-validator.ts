/**
 * Template Validator
 *
 * Manual runtime validation for SharedTemplate JSON — no Zod, just TypeScript.
 * Separates hard errors (will definitely fail to import) from warnings
 * (may import with partial data loss).
 */

import type { SharedTemplate } from './url';

// ==================== CONSTANTS ====================

export const CURRENT_TEMPLATE_VERSION = '2';

/** All versions we can safely import. Unknown versions get a warning, not an error. */
const KNOWN_VERSIONS = new Set(['1', '2']);

// ==================== RESULT TYPE ====================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== GUARDS ====================

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && !isNaN(v);
}

function isValidLocation(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const loc = v as Record<string, unknown>;
  return isString(loc.name) && isFiniteNumber(loc.lat) && isFiniteNumber(loc.lng);
}

// ==================== SANITIZER ====================

function sanitizeStr(v: unknown, maxLen = 200): string {
  if (!isString(v)) return '';
  return v.trim().slice(0, maxLen);
}

/**
 * Sanitize all user-supplied string fields to prevent injection / oversized data.
 * Returns a new object — does not mutate the original.
 */
export function sanitizeSharedTemplate(data: SharedTemplate): SharedTemplate {
  return {
    ...data,
    author: sanitizeStr(data.author),
    trip: {
      ...data.trip,
      title: sanitizeStr(data.trip.title),
      description: sanitizeStr(data.trip.description, 500),
      tags: Array.isArray(data.trip.tags)
        ? data.trip.tags.map(t => sanitizeStr(t, 50)).filter(Boolean)
        : [],
    },
    route: {
      ...data.route,
      origin: { ...data.route.origin, name: sanitizeStr(data.route.origin.name) },
      destination: { ...data.route.destination, name: sanitizeStr(data.route.destination.name) },
      waypoints: (data.route.waypoints || []).map(wp => ({
        ...wp,
        name: sanitizeStr(wp.name),
      })),
    },
    recommendations: data.recommendations?.map(r => ({
      ...r,
      location: r.location ? sanitizeStr(r.location) : undefined,
      notes: r.notes ? sanitizeStr(r.notes, 500) : undefined,
      tips: r.tips ? sanitizeStr(r.tips, 500) : undefined,
    })),
  };
}

// ==================== VALIDATOR ====================

/**
 * Validate a parsed (but untyped) template object.
 *
 * @returns ValidationResult with errors (blocking) and warnings (non-blocking).
 *   If valid === false the template should be rejected.
 *   Warnings are logged but import still proceeds.
 */
export function validateSharedTemplate(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Template must be a JSON object'], warnings };
  }

  const data = raw as Record<string, unknown>;

  // ── type ──────────────────────────────────────────────────────────────────
  if (data.type !== 'roadtrip-template') {
    errors.push(
      `Invalid type: expected 'roadtrip-template', got '${String(data.type)}'`
    );
  }

  // ── version ───────────────────────────────────────────────────────────────
  if (!isString(data.version)) {
    warnings.push('Missing or invalid version field — treating as legacy template');
  } else if (!KNOWN_VERSIONS.has(data.version)) {
    warnings.push(
      `Unknown template version '${data.version}' — some fields may not import correctly`
    );
  }

  // ── id (optional) ─────────────────────────────────────────────────────────
  if (data.id !== undefined && !isString(data.id)) {
    warnings.push('id field is not a string — will be ignored');
  }

  // ── lineage (optional) ────────────────────────────────────────────────────
  if (data.lineage !== undefined) {
    if (!Array.isArray(data.lineage)) {
      errors.push('lineage must be an array of strings');
    } else {
      const badEntries = (data.lineage as unknown[]).filter(e => !isString(e));
      if (badEntries.length > 0) {
        errors.push(`lineage contains ${badEntries.length} non-string element(s)`);
      }
    }
  }

  // ── route ─────────────────────────────────────────────────────────────────
  if (!data.route || typeof data.route !== 'object' || Array.isArray(data.route)) {
    errors.push('Missing or invalid route object');
  } else {
    const route = data.route as Record<string, unknown>;

    if (!isValidLocation(route.origin)) {
      errors.push('route.origin must have a name (string) and valid lat/lng (numbers)');
    } else {
      const o = route.origin as Record<string, unknown>;
      if (Math.abs(o.lat as number) > 90 || Math.abs(o.lng as number) > 180) {
        errors.push('route.origin has out-of-range coordinates');
      }
    }

    if (!isValidLocation(route.destination)) {
      errors.push('route.destination must have a name (string) and valid lat/lng (numbers)');
    } else {
      const d = route.destination as Record<string, unknown>;
      if (Math.abs(d.lat as number) > 90 || Math.abs(d.lng as number) > 180) {
        errors.push('route.destination has out-of-range coordinates');
      }
    }

    if (route.waypoints !== undefined && !Array.isArray(route.waypoints)) {
      errors.push('route.waypoints must be an array');
    }

    if (Array.isArray(route.waypoints)) {
      (route.waypoints as unknown[]).forEach((wp, i) => {
        if (!isValidLocation(wp)) {
          warnings.push(
            `route.waypoints[${i}] is missing valid lat/lng — will be skipped on import`
          );
        }
      });
    }
  }

  // ── trip metadata ──────────────────────────────────────────────────────────
  if (!data.trip || typeof data.trip !== 'object' || Array.isArray(data.trip)) {
    errors.push('Missing or invalid trip metadata object');
  } else {
    const trip = data.trip as Record<string, unknown>;
    if (!isString(trip.title) || (trip.title as string).trim() === '') {
      warnings.push('trip.title is missing or empty');
    }
    if (trip.durationDays !== undefined && !isFiniteNumber(trip.durationDays)) {
      warnings.push('trip.durationDays is not a valid number');
    }
    if (trip.totalDistanceKm !== undefined && !isFiniteNumber(trip.totalDistanceKm)) {
      warnings.push('trip.totalDistanceKm is not a valid number');
    }
  }

  // ── settings (if present) ─────────────────────────────────────────────────
  if (data.settings !== undefined) {
    if (typeof data.settings !== 'object' || Array.isArray(data.settings)) {
      errors.push('settings must be an object if provided');
    } else {
      const s = data.settings as Record<string, unknown>;
      const numericSettingsFields = [
        'maxDriveHours', 'numTravelers', 'numDrivers',
        'gasPrice', 'hotelPricePerNight', 'mealPricePerDay',
      ];
      for (const field of numericSettingsFields) {
        if (s[field] !== undefined) {
          if (!isFiniteNumber(s[field])) {
            errors.push(`settings.${field} must be a valid number (got ${String(s[field])})`);
          } else if ((s[field] as number) < 0) {
            errors.push(`settings.${field} cannot be negative`);
          }
        }
      }
      if (s.numDrivers !== undefined && s.numTravelers !== undefined) {
        const drivers = s.numDrivers as number;
        const travelers = s.numTravelers as number;
        if (isFiniteNumber(drivers) && isFiniteNumber(travelers) && drivers > travelers) {
          warnings.push('settings.numDrivers exceeds numTravelers — will be clamped on import');
        }
      }
    }
  }

  // ── budget consistency (if present) ───────────────────────────────────────
  if (data.budget !== undefined) {
    if (typeof data.budget !== 'object' || Array.isArray(data.budget)) {
      warnings.push('budget is not an object — will be ignored');
    } else {
      const b = data.budget as Record<string, unknown>;
      if (b.breakdown && typeof b.breakdown === 'object' && !Array.isArray(b.breakdown)) {
        const bd = b.breakdown as Record<string, unknown>;
        const parts = ['fuel', 'accommodation', 'food', 'misc'];
        const allNums = parts.every(k => isFiniteNumber(bd[k]));
        if (allNums && isFiniteNumber(b.totalSpent)) {
          const sum = parts.reduce((acc, k) => acc + (bd[k] as number), 0);
          const diff = Math.abs(sum - (b.totalSpent as number));
          if (diff > 1) {
            warnings.push(
              `Budget breakdown sum ($${sum.toFixed(0)}) doesn't match totalSpent ($${(b.totalSpent as number).toFixed(0)})`
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

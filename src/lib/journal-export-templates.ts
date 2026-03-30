import type { TripJournal, TripOrigin, TripSettings } from '../types';
import { showToast } from './toast';
import { getExportBudgetBreakdown, getTripDisplayEndpoints } from './trip-summary-view';
import { resolveJournalEntryLocation } from './journal-trip-view';
import type { JournalExportSummary } from './trip-summary-slices';
import type { PrintInput } from './canonical-trip';
import { buildAutoTitle } from './mee-tokens';
import { buildTemplateLineage } from './url';

// ── Share options ─────────────────────────────────────────────────────────────

export interface ShareOptions {
  includeRoute: boolean;      // required — share button disabled when false
  includeDates: boolean;
  includeTravelers: boolean;
  includeBudget: boolean;
  includeOrigin: boolean;
  includeNotes: boolean;
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  includeRoute: true,
  includeDates: true,
  includeTravelers: true,
  includeBudget: false,
  includeOrigin: true,
  includeNotes: true,
};

// ── Template export ───────────────────────────────────────────────────────────

/**
 * Export the trip as a loadable JSON template that others can import.
 */
export function exportJournalAsTemplate(journal: TripJournal, summary: JournalExportSummary, settings: TripSettings): void {
  const endpoints = getTripDisplayEndpoints(summary);
  const exportBudget = getExportBudgetBreakdown(summary);

  const forkLineage = journal.origin?.type === 'template' && journal.origin.id
    ? buildTemplateLineage({ templateId: journal.origin.id, lineage: undefined, title: '', author: '', description: '', recommendations: undefined })
    : undefined;

  const template = {
    type: 'roadtrip-template',
    version: '1.0',
    id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    author: journal.metadata.travelers?.[0] || 'Anonymous',
    ...(forkLineage ? { lineage: forkLineage } : {}),

    trip: {
      title: journal.metadata.title,
      description: journal.metadata.description || 'Follow this roadtrip route!',
      tags: journal.metadata.tags,
      durationDays: journal.tripSummary.days?.length || 1,
      totalDistanceKm: journal.tripSummary.totalDistanceKm,
      totalDurationHours: (journal.tripSummary.totalDurationMinutes / 60).toFixed(1),
    },

    budget: {
      profile: settings.budget.profile,
      totalSpent: journal.stats.totalActualSpent,
      perPerson: journal.stats.totalActualSpent / settings.numTravelers,
      breakdown: exportBudget,
    },

    route: {
      origin: endpoints.origin,
      destination: endpoints.destination,
      waypoints: summary.segments
        .map(s => s.to)
        .filter((loc, idx, arr) => arr.findIndex(l => l.name === loc.name) === idx),
    },

    recommendations: journal.entries.map(e => {
      const stop = resolveJournalEntryLocation(summary, e);
      return {
        location: stop?.name,
        lat: stop?.lat,
        lng: stop?.lng,
        rating: e.rating,
        notes: e.notes,
        isHighlight: e.isHighlight,
        highlightReason: e.highlightReason,
        wouldStayAgain: e.rating && e.rating >= 4,
        tips: e.notes,
      };
    }).filter(r => r.rating || r.isHighlight),

    // Include settings & vehicle so the plan can be fully loaded
    settings: {
      units: settings.units,
      currency: settings.currency,
      maxDriveHours: settings.maxDriveHours,
      numTravelers: settings.numTravelers,
      numDrivers: settings.numDrivers,
      isRoundTrip: settings.isRoundTrip,
      avoidTolls: settings.avoidTolls,
      avoidBorders: settings.avoidBorders,
      scenicMode: settings.scenicMode,
      routePreference: settings.routePreference,
      stopFrequency: settings.stopFrequency,
      gasPrice: settings.gasPrice,
      hotelPricePerNight: settings.hotelPricePerNight,
      mealPricePerDay: settings.mealPricePerDay,
    },

    vehicle: journal.vehicle,

    importInstructions: 'Load this template in My Experience Engine to follow the same route!',
  };

  const dataBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = journal.metadata.title
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 100) || 'untitled';
  link.download = `trip-template-${safeName}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast({
    message: 'Trip template downloaded! Share it so others can follow your route.',
    type: 'success',
    duration: 4000,
  });
}

/**
 * Export a planned trip (no journal required) as a shareable .json template.
 *
 * Produces the same SharedTemplate format as exportJournalAsTemplate so the
 * Step 1 "Load a MEE Time Template" importer can load it directly.
 *
 * All data comes from PrintInput — no extra props needed.
 * Pass an optional `journal` to include stop notes and memories when
 * `options.includeNotes` is enabled.
 *
 */
export function exportTripAsTemplate(printInput: PrintInput, options: ShareOptions = DEFAULT_SHARE_OPTIONS, journal?: TripJournal, tripOrigin?: TripOrigin): void {
  const { summary, inputs: { locations, settings, vehicle } } = printInput;

  const endpoints = getTripDisplayEndpoints(summary);
  const destination = endpoints.destination?.name || 'Destination';
  const tripTitle = printInput.customTitle ?? buildAutoTitle({ destination });

  const originLoc = locations[0];
  const dest      = locations[locations.length - 1];
  const waypoints = locations.slice(1, -1);

  // Strip origin coords if user chose not to share starting location
  const origin = options.includeOrigin
    ? originLoc
    : { ...originLoc, name: '', lat: 0, lng: 0 };

  const forkLineage = tripOrigin?.type === 'template' && tripOrigin.id
    ? buildTemplateLineage({ templateId: tripOrigin.id, lineage: undefined, title: '', author: '', description: '', recommendations: undefined })
    : undefined;

  const template = {
    type: 'roadtrip-template' as const,
    version: '1.0',
    id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    ...(forkLineage ? { lineage: forkLineage } : {}),
    author: 'MEE',

    trip: {
      title: tripTitle,
      description: 'Follow this route with My Experience Engine!',
      tags: [] as string[],
      durationDays: summary.drivingDays ?? 1,
      totalDistanceKm: Math.round(summary.totalDistanceKm),
      totalDurationHours: (summary.totalDurationMinutes / 60).toFixed(1),
    },

    ...(options.includeBudget && summary.costBreakdown ? {
      budget: {
        profile: settings.budget?.profile ?? 'balanced',
        totalSpent: summary.costBreakdown.total,
        perPerson: summary.costBreakdown.perPerson,
        breakdown: {
          fuel: summary.costBreakdown.fuel,
          accommodation: summary.costBreakdown.accommodation,
          food: summary.costBreakdown.meals,
          misc: summary.costBreakdown.misc,
        },
      },
    } : {}),

    route: { origin, destination: dest, waypoints },

    ...(options.includeNotes && journal ? {
      recommendations: journal.entries
        .filter(e => e.notes || e.rating || e.isHighlight)
        .map(e => {
          const seg = summary.segments[e.segmentIndex];
          return {
            location: seg?.to.name,
            lat: seg?.to.lat,
            lng: seg?.to.lng,
            rating: e.rating,
            notes: e.notes,
            isHighlight: e.isHighlight,
            highlightReason: e.highlightReason,
          };
        }),
      memories: journal.quickCaptures
        .filter(qc => qc.autoTaggedLocation || qc.photo)
        .map(qc => ({
          location: qc.autoTaggedLocation,
          category: qc.category,
          notes: qc.photo?.caption,
          gpsCoords: qc.gpsCoords,
        })),
    } : {}),

    settings: {
      units: settings.units,
      currency: settings.currency,
      maxDriveHours: settings.maxDriveHours,
      ...(options.includeTravelers ? { numTravelers: settings.numTravelers, numDrivers: settings.numDrivers } : {}),
      ...(options.includeDates ? { departureDate: settings.departureDate, returnDate: settings.returnDate } : {}),
      isRoundTrip: settings.isRoundTrip,
      avoidTolls: settings.avoidTolls,
      avoidBorders: settings.avoidBorders,
      scenicMode: settings.scenicMode,
      routePreference: settings.routePreference,
      stopFrequency: settings.stopFrequency,
      gasPrice: settings.gasPrice,
      hotelPricePerNight: settings.hotelPricePerNight,
      mealPricePerDay: settings.mealPricePerDay,
    },

    vehicle,

    importInstructions: 'Load this file in My Experience Engine (Step 1 → Load a MEE Time Template) to follow the same route.',
  };

  const dataBlob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  // eslint-disable-next-line no-control-regex
  const safeName = tripTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 100) || 'mee-time';
  link.download = `mee-time-${safeName}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast({
    message: 'MEE time saved! Share the .json so others can load your route.',
    type: 'success',
    duration: 4000,
  });
}

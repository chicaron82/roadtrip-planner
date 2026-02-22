import type { TripJournal, TripSummary, TripTemplate } from '../../types';

export function generateDefaultTitle(summary: TripSummary): string {
  const origin = summary.segments[0]?.from.name.split(',')[0] || 'Start';
  const dest = summary.segments[summary.segments.length - 1]?.to.name.split(',')[0] || 'Destination';
  return `${origin} to ${dest}`;
}

export function computeJournalStats(journal: TripJournal): TripJournal['stats'] {
  const photosCount = journal.entries.reduce((sum, e) => sum + e.photos.length, 0) +
    journal.quickCaptures.length;

  const highlightsCount = journal.entries.filter(e => e.isHighlight).length;
  const stopsVisited = journal.entries.filter(e => e.status === 'visited').length;
  const stopsSkipped = journal.entries.filter(e => e.status === 'skipped').length;

  const totalActualSpent = journal.budgetActuals.reduce((sum, a) => sum + a.actual, 0);
  const totalPlanned = journal.budgetActuals.reduce((sum, a) => sum + a.planned, 0);
  const budgetVariance = totalActualSpent - totalPlanned;

  return {
    photosCount,
    highlightsCount,
    stopsVisited,
    stopsSkipped,
    totalActualSpent,
    budgetVariance,
  };
}

export function determineBudgetLevel(total: number): 'budget' | 'moderate' | 'comfort' {
  if (total < 500) return 'budget';
  if (total < 1500) return 'moderate';
  return 'comfort';
}

export function extractLocations(summary: TripSummary): TripTemplate['route']['locations'] {
  const locations = [summary.segments[0]?.from];

  // Add unique waypoints
  summary.segments.forEach(seg => {
    if (!locations.find(l => l.id === seg.to.id)) {
      locations.push(seg.to);
    }
  });

  return locations.filter(Boolean);
}

export function getStopName(journal: TripJournal, segmentIndex: number): string {
  const segment = journal.tripSummary.segments[segmentIndex];
  return segment?.to.name.split(',')[0] || `Stop ${segmentIndex + 1}`;
}

/** UTC offset in hours for North American timezone abbreviations. */
export function getUtcOffsetHours(abbr: string): number | null {
  const offsets: Record<string, number> = {
    'PST': -8, 'PDT': -7,
    'MST': -7, 'MDT': -6,
    'CST': -6, 'CDT': -5,
    'EST': -5, 'EDT': -4,
    'AST': -4, 'ADT': -3,       // Atlantic (Maritimes)
    'NST': -3.5, 'NDT': -2.5,   // Newfoundland
    'AKST': -9, 'AKDT': -8,     // Alaska
    'HST': -10, 'HDT': -9,      // Hawaii
  };
  return offsets[abbr] ?? null;
}

/**
 * Wall-clock shift in hours when crossing from one timezone to another.
 * Positive = clocks jump forward (lose time). CDT→EDT = +1.
 */
export function getTimezoneShiftHours(fromAbbr: string | null, toAbbr: string | null): number {
  if (!fromAbbr || !toAbbr || fromAbbr === toAbbr) return 0;
  const fromOffset = getUtcOffsetHours(fromAbbr);
  const toOffset = getUtcOffsetHours(toAbbr);
  if (fromOffset === null || toOffset === null) return 0;
  return toOffset - fromOffset;
}

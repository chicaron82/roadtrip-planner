/**
 * Get timezone offset between two timezone abbreviations.
 * Simplified for common North American timezones.
 */
export function getTimezoneOffset(from: string, to: string): number {
  const offsets: Record<string, number> = {
    'PST': -8, 'PDT': -7,
    'MST': -7, 'MDT': -6,
    'CST': -6, 'CDT': -5,
    'EST': -5, 'EDT': -4,
  };

  const fromOffset = offsets[from] || 0;
  const toOffset = offsets[to] || 0;
  return toOffset - fromOffset;
}

/**
 * Get full timezone name from abbreviation.
 */
export function getTimezoneName(abbr: string): string {
  const names: Record<string, string> = {
    'PST': 'Pacific Standard Time',
    'PDT': 'Pacific Daylight Time',
    'MST': 'Mountain Standard Time',
    'MDT': 'Mountain Daylight Time',
    'CST': 'Central Standard Time',
    'CDT': 'Central Daylight Time',
    'EST': 'Eastern Standard Time',
    'EDT': 'Eastern Daylight Time',
  };
  return names[abbr] || `${abbr} Time Zone`;
}

/**
 * location-sanitizer.ts — Strip geocoder bloat from raw display_name strings.
 *
 * Photon results are already built from structured fields (name, city, state)
 * and don't need this. Nominatim returns a raw display_name like:
 *   "Thunder Bay, Thunder Bay District, ON P7B 6B3, Canada"
 * This utility turns that into "Thunder Bay, Ontario".
 *
 * Rules:
 *  - Strip census/admin divisions (Division No., Improvement District, County, etc.)
 *  - Strip postal/ZIP codes; extract the province/state from the same segment
 *  - Strip standalone country names
 *  - Expand 2-letter Canadian province codes to full names
 *  - Deduplicate consecutive identical segments (e.g. "New York, New York")
 */

const CA_PROVINCES: Record<string, string> = {
  AB: 'Alberta',       BC: 'British Columbia', MB: 'Manitoba',
  NB: 'New Brunswick', NL: 'Newfoundland and Labrador', NS: 'Nova Scotia',
  NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario',
  PE: 'Prince Edward Island',  QC: 'Quebec',  SK: 'Saskatchewan',
  YT: 'Yukon',
};

const COUNTRY_NAMES = new Set([
  'canada', 'united states', 'united states of america', 'usa', 'us',
  'united kingdom', 'uk', 'australia', 'new zealand', 'france',
  'germany', 'mexico', 'ireland',
]);

function isAdminBloat(segment: string): boolean {
  return (
    /\bDivision No\.\s*\d+/i.test(segment) ||
    /\bDistrict No\.\s*\d+/i.test(segment) ||
    /\bImprovement District\b/i.test(segment) ||
    /\bCensus (Sub-?)?Division\b/i.test(segment) ||
    /\bUnorganized\b/i.test(segment) ||
    /\b(County|Parish|Borough|Township)\s*$/i.test(segment) ||
    /\s+(District Municipality|Regional Municipality|Rural Municipality|Municipality)\s*$/i.test(segment) ||
    // "Thunder Bay District" — trailing District after a non-"of" word
    /^(?!District of\b).+\s+District\s*$/i.test(segment)
  );
}

function isCountryName(segment: string): boolean {
  return COUNTRY_NAMES.has(segment.toLowerCase());
}

function containsPostalCode(segment: string): boolean {
  return (
    /[A-Z]\d[A-Z]\s*\d[A-Z]\d/.test(segment) || // CA full: T2P 1J9
    /\b[A-Z]\d[A-Z]\b/.test(segment) ||           // CA partial: T2P
    /\b\d{5}(-\d{4})?\b/.test(segment)            // US ZIP
  );
}

/**
 * Extract province/state from a segment that contains a postal code.
 * "ON P7B 6B3"    → "Ontario"
 * "Manitoba R3C"  → "Manitoba"
 * "California 90210" → "California"
 */
function extractFromPostalSegment(segment: string): string | null {
  // Bare 2-letter province + CA postal: "ON P7B 6B3" or "ON P7B"
  const bare = segment.match(/^([A-Z]{2})\s+[A-Z]\d/);
  if (bare) return CA_PROVINCES[bare[1]] ?? bare[1];

  // Province/state name + postal: "Manitoba R3C 1A3", "California 90210"
  const named =
    segment.match(/^(.+?)\s+[A-Z]\d[A-Z](\s+\d[A-Z]\d)?\s*$/) ||
    segment.match(/^(.+?)\s+\d{5}(-\d{4})?\s*$/);
  if (named) {
    const candidate = named[1].trim();
    return CA_PROVINCES[candidate] ?? candidate;
  }

  return null;
}

/**
 * Sanitize a raw Nominatim display_name into a clean human-readable location.
 *
 * @example
 * sanitizeLocationName('Thunder Bay, Thunder Bay District, ON P7B 6B3, Canada')
 * // → 'Thunder Bay, Ontario'
 *
 * sanitizeLocationName('Banff National Park, Improvement District No. 9, AB, Canada')
 * // → 'Banff National Park, Alberta'
 */
export function sanitizeLocationName(raw: string): string {
  const segments = raw.split(',').map(s => s.trim()).filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Only strip admin bloat on non-first segments — the first is always the destination name
    if (i > 0 && isAdminBloat(segment)) continue;
    if (isCountryName(segment)) continue;

    if (containsPostalCode(segment)) {
      const extracted = extractFromPostalSegment(segment);
      if (extracted) kept.push(extracted);
      continue;
    }

    // Standalone 2-letter CA province code
    if (/^[A-Z]{2}$/.test(segment) && CA_PROVINCES[segment]) {
      kept.push(CA_PROVINCES[segment]);
      continue;
    }

    kept.push(segment);
  }

  // Deduplicate consecutive identical segments (case-insensitive)
  return kept
    .filter((v, i) => i === 0 || v.toLowerCase() !== kept[i - 1].toLowerCase())
    .join(', ');
}

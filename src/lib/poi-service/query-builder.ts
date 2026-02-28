import type { POISuggestionCategory, Location } from '../../types';
import { CATEGORY_TAG_QUERIES } from './config';

/**
 * Build a single Overpass union query for ALL discovery categories in one bbox.
 * Queries node + way only — relation queries over large bboxes are too expensive
 * and timeout silently. Provincial parks (relations) are handled separately
 * by buildParkRelationQuery() using targeted around: sample points.
 */
export function buildCorridorQuery(bbox: string, categories: POISuggestionCategory[]): string {
  const lines: string[] = [];
  for (const cat of categories) {
    for (const tag of CATEGORY_TAG_QUERIES[cat]) {
      lines.push(`      node${tag}(${bbox});`);
      lines.push(`      way${tag}(${bbox});`);
    }
  }

  return `
    [out:json][timeout:45][maxsize:5242880];
    (
${lines.join('\n')}
    );
    out center;
  `.trim();
}

/**
 * Build a targeted Overpass query for named boundary=protected_area relations
 * at multiple sample points along the route using around: queries.
 *
 * Why relations, why around: ?
 * Canadian/US provincial and national parks are stored as OSM relations tagged
 * boundary=protected_area. Querying relations over a large bbox times out.
 * Small around: circles at sample points are fast and hit the actual corridor.
 * The ["name"] filter ensures we only return named parks worth discovering.
 */
export function buildParkRelationQuery(samplePoints: [number, number][], radiusM: number = 20000): string {
  const lines = samplePoints.map(
    ([lat, lng]) => `      relation["boundary"="protected_area"]["name"](around:${radiusM},${lat},${lng});`
  );
  return `
    [out:json][timeout:30];
    (
${lines.join('\n')}
    );
    out center;
  `.trim();
}

/**
 * Build a corridor query using targeted around: circles at sample points.
 *
 * Replaces the single bbox approach: a bbox over Toronto→Thunder Bay fills the
 * 5 MB Overpass cap with dense city OSM data instead of actual route-corridor
 * content. Using around: at regularly-spaced sample points restricts results to
 * within `radiusM` of the actual road.
 *
 * Queries node + way only (relations are handled by buildParkRelationQuery).
 * All sample points are packed into ONE Overpass query to minimise round-trips.
 */
export function buildBucketAroundQuery(
  samplePoints: [number, number][],
  radiusM: number,
  categories: POISuggestionCategory[]
): string {
  const lines: string[] = [];
  for (const [lat, lng] of samplePoints) {
    for (const cat of categories) {
      for (const tag of CATEGORY_TAG_QUERIES[cat]) {
        lines.push(`      node${tag}(around:${radiusM},${lat},${lng});`);
        lines.push(`      way${tag}(around:${radiusM},${lat},${lng});`);
      }
    }
  }

  return `
    [out:json][timeout:60][maxsize:5242880];
    (
${lines.join('\n')}
    );
    out center;
  `.trim();
}

/**
 * Build Overpass QL query for destination area search.
 * Queries node + way + relation for each tag filter — relations catch
 * provincial/national parks near the destination (e.g. Sleeping Giant PP
 * near Thunder Bay is a boundary=protected_area relation).
 */
export function buildDestinationQuery(
  destination: Location,
  categories: POISuggestionCategory[],
  radius: number
): string {
  const lines: string[] = [];
  for (const cat of categories) {
    for (const tag of CATEGORY_TAG_QUERIES[cat]) {
      lines.push(`      node${tag}(around:${radius},${destination.lat},${destination.lng});`);
      lines.push(`      way${tag}(around:${radius},${destination.lat},${destination.lng});`);
      lines.push(`      relation${tag}(around:${radius},${destination.lat},${destination.lng});`);
    }
  }

  return `
    [out:json][timeout:45];
    (
${lines.join('\n')}
    );
    out center;
  `.trim();
}

/**
 * Estimate total route distance from geometry (Haversine sum)
 */
export function estimateRouteDistanceKm(geometry: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lng1] = geometry[i - 1];
    const [lat2, lng2] = geometry[i];
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

/**
 * Haversine distance between two points (km)
 */
export function haversineDistanceSimple(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute a bounding box from route geometry with a buffer in km.
 * Returns "south,west,north,east" Overpass bbox string.
 */
export function computeRouteBbox(routeGeometry: [number, number][], bufferKm: number): string {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of routeGeometry) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const latBuffer = bufferKm / 111; // ~1 degree lat ≈ 111 km (constant)
  // Longitude degrees shrink toward the poles: 1° lng ≈ 111 * cos(lat) km.
  // Use the route midpoint latitude for the scaling factor.
  const midLat = (minLat + maxLat) / 2;
  const lngBuffer = bufferKm / (111 * Math.cos(midLat * Math.PI / 180));
  return `${minLat - latBuffer},${minLng - lngBuffer},${maxLat + latBuffer},${maxLng + lngBuffer}`;
}

/**
 * Sample the route polyline at regular km intervals.
 * Returns at most maxSamples evenly-spaced coordinate pairs.
 */
export function sampleRouteByKm(
  geometry: [number, number][],
  stepKm: number,
  maxSamples: number = 15
): [number, number][] {
  if (geometry.length === 0) return [];
  const samples: [number, number][] = [geometry[0]];
  let accumulated = 0;
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lng1] = geometry[i - 1];
    const [lat2, lng2] = geometry[i];
    accumulated += haversineDistanceSimple(lat1, lng1, lat2, lng2);
    if (accumulated >= stepKm) {
      samples.push(geometry[i]);
      accumulated = 0;
      if (samples.length >= maxSamples) break;
    }
  }
  return samples;
}

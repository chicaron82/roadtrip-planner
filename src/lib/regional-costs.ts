/**
 * Regional hotel cost multipliers relative to Manitoba (baseline 1.0).
 * Applied to settings.hotelPricePerNight when computing overnight stop costs.
 *
 * Source: approximate relative cost-of-living indices for accommodation,
 * not real-time pricing. Represents the typical difference travellers experience.
 */
const HOTEL_MULTIPLIERS: Record<string, number> = {
  // Canadian provinces / territories
  BC:  1.35,  // Vancouver effect
  AB:  1.10,  // Calgary / Edmonton
  SK:  0.90,  // Regina / Saskatoon
  MB:  1.00,  // Winnipeg — baseline
  ON:  1.40,  // Toronto premium
  QC:  1.20,  // Montreal / Quebec City
  NS:  1.05,  // Halifax
  NB:  0.95,
  NL:  1.00,
  PE:  0.95,
  NT:  1.15,
  YT:  1.10,
  NU:  1.20,

  // US states — major route states for cross-border trips
  WA:  1.30,  // Seattle
  OR:  1.20,  // Portland
  CA:  1.60,  // California premium
  NV:  1.20,  // Las Vegas
  AZ:  1.10,
  CO:  1.15,  // Denver
  TX:  1.05,
  FL:  1.15,
  NY:  1.70,  // New York City effect
  IL:  1.20,  // Chicago
  OH:  1.00,
  MI:  1.05,
  WI:  1.00,
  MN:  1.05,  // Minneapolis
  IA:  0.95,
  ND:  0.90,
  SD:  0.90,
  MT:  0.95,
  ID:  0.95,
  WY:  0.90,
  NE:  0.95,
  KS:  0.95,
  MO:  1.00,
  IN:  0.95,
  PA:  1.10,
  VA:  1.10,
  NC:  1.00,
  GA:  1.05,
  TN:  1.00,
  KY:  0.95,
  AL:  0.95,
  MS:  0.90,
  AR:  0.90,
  LA:  1.05,
  OK:  0.95,
  NM:  0.95,
};

/**
 * Extract a province/state code from a geocoded location name ("City, XX" format).
 * Returns null if no recognisable code is found.
 */
function extractRegionCode(locationName: string): string | null {
  const parts = locationName.split(',');
  if (parts.length < 2) return null;
  const code = parts[parts.length - 1].trim().toUpperCase();
  // Must be 2 uppercase letters (CA-ON style already stripped by geocoder)
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * Return the hotel cost multiplier for the given location name.
 * Falls back to 1.0 if the region is unrecognised.
 */
export function getHotelMultiplier(locationName: string): number {
  const code = extractRegionCode(locationName);
  if (!code) return 1.0;
  return HOTEL_MULTIPLIERS[code] ?? 1.0;
}

/**
 * Regional hotel cost multipliers relative to Manitoba (baseline 1.0).
 * Applied to settings.hotelPricePerNight when computing overnight stop costs.
 *
 * Source: approximate relative cost-of-living indices for accommodation,
 * not real-time pricing. Represents the typical difference travellers experience.
 */
export const HOTEL_MULTIPLIERS: Record<string, number> = {
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

// ── Fuel prices ───────────────────────────────────────────────────────────────

/**
 * Approximate pump prices per litre by Canadian province/territory (CAD).
 * Source: NRCan weekly averages, updated Q1 2026.
 * Tuned manually — refresh quarterly from https://www2.nrcan.gc.ca/ene/sources/lpg
 */
const FUEL_PRICES_CAD: Record<string, number> = {
  BC: 1.82,  // Vancouver premium + carbon levy
  AB: 1.41,  // Lower taxes, no provincial carbon surcharge
  SK: 1.50,
  MB: 1.55,  // Winnipeg — app baseline
  ON: 1.62,  // Toronto area
  QC: 1.68,  // Higher provincial taxes
  NS: 1.63,
  NB: 1.59,
  NL: 1.67,
  PE: 1.61,
  NT: 1.90,  // Remote — trucked in
  YT: 1.82,
  NU: 2.20,  // Most expensive in Canada
};

/**
 * Approximate pump prices per litre by US state (USD).
 * Derived from EIA weekly averages (USD/gal ÷ 3.785), rounded to 2dp.
 * Source: api.eia.gov, updated Q1 2026.
 */
const FUEL_PRICES_USD: Record<string, number> = {
  // West Coast
  CA: 1.19,  // $4.50/gal
  WA: 1.00,  // $3.80/gal
  OR: 0.95,  // $3.60/gal
  // Mountain / Southwest
  NV: 0.90,  // $3.40/gal
  AZ: 0.82,  // $3.10/gal
  CO: 0.79,  // $3.00/gal
  UT: 0.82,  // $3.10/gal
  ID: 0.82,
  MT: 0.81,  // $3.05/gal
  WY: 0.77,  // $2.90/gal
  NM: 0.79,
  // Great Plains
  ND: 0.78,  // $2.95/gal
  SD: 0.77,
  NE: 0.78,
  KS: 0.75,  // $2.85/gal
  // Midwest
  MN: 0.79,  // $3.00/gal
  WI: 0.80,
  IA: 0.77,
  IL: 0.86,  // $3.25/gal — state taxes
  MI: 0.81,  // $3.05/gal
  OH: 0.79,
  IN: 0.79,
  MO: 0.77,
  // South
  TX: 0.75,  // $2.85/gal
  OK: 0.74,  // $2.80/gal
  AR: 0.74,
  LA: 0.77,
  MS: 0.74,
  AL: 0.75,
  TN: 0.77,
  KY: 0.77,
  GA: 0.77,  // $2.90/gal
  FL: 0.82,  // $3.10/gal
  NC: 0.78,
  SC: 0.77,
  // Northeast
  VA: 0.81,
  PA: 0.85,  // $3.20/gal
  NY: 0.93,  // $3.50/gal — taxes
  NJ: 0.83,
  CT: 0.88,
  MA: 0.87,
  // Alaska
  AK: 1.06,  // $4.00/gal
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract a province/state code from a geocoded location name ("City, XX" format).
 * Returns null if no recognisable code is found.
 */
export function extractRegionCode(locationName: string): string | null {
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

/**
 * Return a regional fuel price per litre for a given location.
 *
 * - Canadian province → CAD/L price (always, regardless of currency setting)
 * - US state + currency 'USD' → USD/L price
 * - Mismatch (US state with CAD currency, or unknown region) → null (caller keeps default)
 */
export function getRegionalFuelPrice(locationName: string, currency: 'CAD' | 'USD'): number | null {
  const code = extractRegionCode(locationName);
  if (!code) return null;

  if (currency === 'CAD' && code in FUEL_PRICES_CAD) {
    return FUEL_PRICES_CAD[code];
  }
  if (currency === 'USD' && code in FUEL_PRICES_USD) {
    return FUEL_PRICES_USD[code];
  }
  return null;
}

/** Legacy alias for origin-based default logic */
export const getFuelPriceDefault = getRegionalFuelPrice;

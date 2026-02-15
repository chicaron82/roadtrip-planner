export interface VehicleStats {
  city: number; // L/100km
  hwy: number; // L/100km
  tank: number; // Litres
  isEV?: boolean; // Electric vehicle flag
}

// Data source: Natural Resources Canada 2024 Fuel Consumption Guide (averaged for generic models)
export const VEHICLE_DB: Record<string, Record<string, VehicleStats>> = {
  "Toyota": {
    "Camry": { city: 8.2, hwy: 6.0, tank: 60 },
    "Corolla": { city: 7.4, hwy: 5.7, tank: 50 },
    "RAV4": { city: 8.5, hwy: 6.8, tank: 55 },
    "Highlander": { city: 11.8, hwy: 8.6, tank: 68 },
    "Tacoma": { city: 12.0, hwy: 10.0, tank: 80 },
    "Tundra": { city: 13.5, hwy: 10.5, tank: 122 },
    "Prius": { city: 4.5, hwy: 4.4, tank: 43 },
    "Sienna": { city: 6.6, hwy: 6.5, tank: 68 },
    "4Runner": { city: 14.8, hwy: 12.5, tank: 87 },
  },
  "Honda": {
    "Civic": { city: 7.7, hwy: 6.0, tank: 47 },
    "Accord": { city: 8.1, hwy: 6.4, tank: 56 },
    "CR-V": { city: 8.4, hwy: 7.1, tank: 53 },
    "Pilot": { city: 12.4, hwy: 9.3, tank: 70 },
    "Odyssey": { city: 12.2, hwy: 8.5, tank: 73.8 },
    "HR-V": { city: 9.1, hwy: 7.4, tank: 50 },
    "Ridgeline": { city: 12.8, hwy: 9.9, tank: 73.8 },
  },
  "Ford": {
    "F-150": { city: 13.5, hwy: 10.2, tank: 87 }, // 2.7L EcoBoost
    "Escape": { city: 8.9, hwy: 6.9, tank: 57 },
    "Explorer": { city: 11.7, hwy: 9.0, tank: 68 },
    "Mustang": { city: 11.5, hwy: 8.0, tank: 60 },
    "Edge": { city: 11.5, hwy: 8.3, tank: 70 },
    "Bronco": { city: 12.5, hwy: 11.0, tank: 79 },
    "Ranger": { city: 11.5, hwy: 9.5, tank: 68 },
    "Expedition": { city: 14.5, hwy: 11.5, tank: 93 },
  },
  "Chevrolet": {
    "Silverado": { city: 14.5, hwy: 11.0, tank: 91 },
    "Equinox": { city: 9.5, hwy: 7.5, tank: 56 },
    "Malibu": { city: 8.5, hwy: 6.5, tank: 60 },
    "Traverse": { city: 13.0, hwy: 9.5, tank: 83 },
    "Tahoe": { city: 15.5, hwy: 11.5, tank: 91 },
    "Suburban": { city: 15.5, hwy: 11.5, tank: 106 },
    "Colorado": { city: 12.5, hwy: 9.5, tank: 80 },
  },
  "Tesla": {
    // Using kWh/100km for EVs (battery capacity in tank field)
    "Model 3": { city: 1.6, hwy: 1.4, tank: 57.5, isEV: true },
    "Model Y": { city: 1.7, hwy: 1.5, tank: 75, isEV: true },
    "Model S": { city: 1.8, hwy: 1.6, tank: 100, isEV: true },
    "Model X": { city: 2.0, hwy: 1.8, tank: 100, isEV: true },
    "Cybertruck": { city: 2.5, hwy: 2.5, tank: 123, isEV: true },
  },
  "Nissan": {
    "Rogue": { city: 8.5, hwy: 6.8, tank: 55 },
    "Altima": { city: 8.8, hwy: 6.0, tank: 61 },
    "Sentra": { city: 8.0, hwy: 6.0, tank: 47 },
    "Pathfinder": { city: 11.6, hwy: 9.2, tank: 70 },
    "Frontier": { city: 13.0, hwy: 10.0, tank: 80 },
  },
  "Jeep": {
    "Grand Cherokee": { city: 12.5, hwy: 9.5, tank: 87 },
    "Wrangler": { city: 13.0, hwy: 10.0, tank: 81 },
    "Cherokee": { city: 11.0, hwy: 8.5, tank: 60 },
    "Compass": { city: 10.0, hwy: 7.5, tank: 51 },
    "Gladiator": { city: 14.0, hwy: 10.5, tank: 83 },
  },
  "Hyundai": {
    "Tucson": { city: 9.0, hwy: 7.0, tank: 54 },
    "Elantra": { city: 7.5, hwy: 5.5, tank: 47 },
    "Santa Fe": { city: 10.5, hwy: 8.5, tank: 67 },
    "Sonata": { city: 8.5, hwy: 6.5, tank: 60 },
    "Kona": { city: 8.0, hwy: 7.0, tank: 50 },
    "Palisade": { city: 12.0, hwy: 9.0, tank: 71 },
  },
  "Subaru": {
    "Outback": { city: 9.5, hwy: 7.5, tank: 70 },
    "Forester": { city: 9.0, hwy: 7.2, tank: 63 },
    "Crosstrek": { city: 8.5, hwy: 7.0, tank: 63 },
    "Ascent": { city: 11.5, hwy: 9.0, tank: 73 },
    "Impreza": { city: 8.5, hwy: 6.5, tank: 50 },
  },
  "Kia": {
    "Sportage": { city: 9.5, hwy: 7.5, tank: 54 },
    "Sorento": { city: 10.5, hwy: 8.5, tank: 67 },
    "Telluride": { city: 12.0, hwy: 9.0, tank: 71 },
    "Forte": { city: 8.0, hwy: 6.0, tank: 53 },
    "Soul": { city: 8.5, hwy: 7.0, tank: 54 },
  },
};

export const COMMON_MAKES = Object.keys(VEHICLE_DB).sort();

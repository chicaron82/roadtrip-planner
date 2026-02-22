import type {
  AdventureConfig,
  AdventureDestination,
  AdventureResult,
  BudgetProfile,
  TripPreference,
} from '../types';

// Average costs for budget calculations
const COST_ESTIMATES = {
  fuel: {
    perKm: 0.12, // ~$0.12/km for average car (adjust based on vehicle)
  },
  accommodation: {
    budget: 80,
    moderate: 150,
    comfort: 250,
  },
  food: {
    perPersonPerDay: 50, // Average meal budget
  },
};

// Curated static destination database for Adventure Mode.
// Intentionally hand-picked — covers popular road trip targets in Canada and the US reachable
// from central Canada. Expanding this list (or replacing it with a live API) is a future concern.
const POPULAR_DESTINATIONS: Array<{
  name: string;
  lat: number;
  lng: number;
  category: AdventureDestination['category'];
  description: string;
  tags: string[];
  imageUrl?: string;
}> = [
  // Western Canada
  { name: 'Banff', lat: 51.1784, lng: -115.5708, category: 'mountain', description: 'Stunning Rocky Mountain views, hot springs, and world-class skiing', tags: ['scenic', 'hiking', 'skiing', 'nature'], imageUrl: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=400' },
  { name: 'Jasper', lat: 52.8737, lng: -118.0814, category: 'nature', description: 'Dark sky preserve with pristine wilderness and wildlife', tags: ['scenic', 'wildlife', 'camping', 'stars'], imageUrl: 'https://images.unsplash.com/photo-1609825488888-3a766db05542?w=400' },
  { name: 'Tofino', lat: 49.1530, lng: -125.9066, category: 'beach', description: 'Surfing, storm watching, and rainforest trails', tags: ['beach', 'surfing', 'nature', 'relaxing'], imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
  { name: 'Kelowna', lat: 49.8880, lng: -119.4960, category: 'nature', description: 'Wine country with beautiful lakes and orchards', tags: ['wine', 'lakes', 'foodie', 'relaxing'], imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },
  { name: 'Whistler', lat: 50.1163, lng: -122.9574, category: 'mountain', description: 'Year-round mountain resort with biking and skiing', tags: ['skiing', 'biking', 'adventure', 'dining'], imageUrl: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=400' },
  { name: 'Victoria', lat: 48.4284, lng: -123.3656, category: 'city', description: 'British charm, gardens, and whale watching', tags: ['city', 'gardens', 'historic', 'foodie'], imageUrl: 'https://images.unsplash.com/photo-1559511260-66a68e4caa7f?w=400' },

  // US Pacific Northwest
  { name: 'Seattle', lat: 47.6062, lng: -122.3321, category: 'city', description: 'Coffee culture, tech hub, and stunning waterfront', tags: ['city', 'foodie', 'music', 'culture'], imageUrl: 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=400' },
  { name: 'Portland', lat: 45.5155, lng: -122.6789, category: 'city', description: 'Quirky vibes, craft beer, and food trucks', tags: ['city', 'foodie', 'beer', 'artsy'], imageUrl: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=400' },
  { name: 'Olympic National Park', lat: 47.8021, lng: -123.6044, category: 'nature', description: 'Rainforests, mountains, and rugged coastline', tags: ['nature', 'hiking', 'camping', 'beach'], imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400' },

  // California
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, category: 'city', description: 'Golden Gate, cable cars, and diverse neighborhoods', tags: ['city', 'iconic', 'foodie', 'culture'], imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400' },
  { name: 'Yosemite', lat: 37.8651, lng: -119.5383, category: 'nature', description: 'Iconic granite cliffs and giant sequoias', tags: ['nature', 'hiking', 'scenic', 'camping'], imageUrl: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=400' },
  { name: 'Lake Tahoe', lat: 39.0968, lng: -120.0324, category: 'nature', description: 'Crystal clear alpine lake with year-round activities', tags: ['lakes', 'skiing', 'hiking', 'scenic'], imageUrl: 'https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=400' },
  { name: 'Napa Valley', lat: 38.2975, lng: -122.2869, category: 'nature', description: 'World-renowned wine country and fine dining', tags: ['wine', 'foodie', 'romantic', 'relaxing'], imageUrl: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400' },

  // Mountain States
  { name: 'Yellowstone', lat: 44.4280, lng: -110.5885, category: 'nature', description: 'Geysers, hot springs, and abundant wildlife', tags: ['nature', 'wildlife', 'geothermal', 'iconic'], imageUrl: 'https://images.unsplash.com/photo-1533167649158-6d508895b680?w=400' },
  { name: 'Grand Canyon', lat: 36.0544, lng: -112.1401, category: 'nature', description: 'One of the world\'s most spectacular natural wonders', tags: ['nature', 'hiking', 'scenic', 'iconic'], imageUrl: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=400' },
  { name: 'Moab', lat: 38.5733, lng: -109.5498, category: 'nature', description: 'Red rock arches and extreme outdoor adventures', tags: ['adventure', 'hiking', 'biking', 'scenic'], imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400' },
  { name: 'Jackson Hole', lat: 43.4799, lng: -110.7624, category: 'mountain', description: 'Gateway to Grand Teton with skiing and wildlife', tags: ['skiing', 'wildlife', 'scenic', 'adventure'], imageUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400' },

  // Eastern Canada
  { name: 'Montreal', lat: 45.5017, lng: -73.5673, category: 'city', description: 'European flair, festivals, and incredible food scene', tags: ['city', 'foodie', 'culture', 'nightlife'], imageUrl: 'https://images.unsplash.com/photo-1519178614-68673b201f36?w=400' },
  { name: 'Quebec City', lat: 46.8139, lng: -71.2080, category: 'historic', description: 'Old world charm with cobblestone streets and history', tags: ['historic', 'romantic', 'culture', 'foodie'], imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' },
  { name: 'Niagara Falls', lat: 43.0962, lng: -79.0377, category: 'nature', description: 'Iconic waterfalls on the US-Canada border', tags: ['nature', 'iconic', 'family', 'romantic'], imageUrl: 'https://images.unsplash.com/photo-1489447068241-b3490214e879?w=400' },
  { name: 'Ottawa', lat: 45.4215, lng: -75.6972, category: 'city', description: 'Canada\'s capital with museums and the Rideau Canal', tags: ['city', 'historic', 'culture', 'family'], imageUrl: 'https://images.unsplash.com/photo-1569681157356-2a69a7b8ae38?w=400' },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832, category: 'city', description: 'Diverse metropolis with world-class dining and entertainment', tags: ['city', 'foodie', 'culture', 'diverse'], imageUrl: 'https://images.unsplash.com/photo-1517090504586-fde19ea6066f?w=400' },

  // Atlantic Canada
  { name: 'Halifax', lat: 44.6488, lng: -63.5752, category: 'city', description: 'Maritime history, seafood, and coastal beauty', tags: ['historic', 'foodie', 'coastal', 'friendly'], imageUrl: 'https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?w=400' },
  { name: 'Cape Breton', lat: 46.2382, lng: -60.8785, category: 'nature', description: 'Cabot Trail scenic drive and Celtic culture', tags: ['scenic', 'nature', 'culture', 'coastal'], imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },

  // Central Canada / Prairie Provinces
  { name: 'Calgary', lat: 51.0447, lng: -114.0719, category: 'city', description: 'Gateway to the Rockies, Stampede, and urban energy', tags: ['city', 'adventure', 'culture', 'skiing'], imageUrl: 'https://images.unsplash.com/photo-1517935706615-2717063c2225?w=400' },
  { name: 'Edmonton', lat: 53.5461, lng: -113.4938, category: 'city', description: 'River valley trails, festivals, and West Edmonton Mall', tags: ['city', 'shopping', 'culture', 'family'], imageUrl: 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=400' },
  { name: 'Regina', lat: 50.4452, lng: -104.6189, category: 'city', description: 'Prairie capital with beautiful parks and museums', tags: ['city', 'culture', 'budget', 'family'], imageUrl: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400' },
  { name: 'Saskatoon', lat: 52.1579, lng: -106.6702, category: 'city', description: 'City of bridges on the South Saskatchewan River', tags: ['city', 'nature', 'culture', 'friendly'], imageUrl: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400' },

  // US Midwest (reachable from central Canada)
  { name: 'Minneapolis', lat: 44.9778, lng: -93.2650, category: 'city', description: 'Twin Cities with lakes, arts, and vibrant food scene', tags: ['city', 'foodie', 'culture', 'lakes'], imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400' },
  { name: 'Fargo', lat: 46.8772, lng: -96.7898, category: 'city', description: 'Charming downtown, craft breweries, and friendly vibes', tags: ['city', 'beer', 'budget', 'friendly'], imageUrl: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400' },
  { name: 'Duluth', lat: 46.7867, lng: -92.1005, category: 'nature', description: 'Lake Superior port city with stunning scenery', tags: ['nature', 'lakes', 'scenic', 'hiking'], imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, category: 'city', description: 'World-class architecture, deep dish pizza, and lakefront', tags: ['city', 'foodie', 'culture', 'iconic'], imageUrl: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=400' },

  // Northern Ontario
  { name: 'Thunder Bay', lat: 48.3809, lng: -89.2477, category: 'nature', description: 'Gateway to Lake Superior with outdoor adventures', tags: ['nature', 'hiking', 'scenic', 'adventure'], imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },
];

/**
 * Calculate the maximum one-way distance reachable within budget
 */
export function calculateMaxDistance(config: AdventureConfig): number {
  const { budget, days, travelers } = config;
  const accommodationType = config.accommodationType || 'moderate';
  const isRoundTrip = config.isRoundTrip !== false; // Default to true

  // Calculate fixed costs
  const nights = Math.max(0, days - 1);
  const accommodationCost = nights * COST_ESTIMATES.accommodation[accommodationType];
  const foodCost = days * travelers * COST_ESTIMATES.food.perPersonPerDay;
  const fixedCosts = accommodationCost + foodCost;

  // Remaining budget for fuel
  const fuelBudget = Math.max(0, budget - fixedCosts);

  // Calculate max distance based on trip type
  const maxDrivableKm = fuelBudget / COST_ESTIMATES.fuel.perKm;

  // For round trip, divide by 2 (need to drive both ways)
  // For one-way, use full distance
  return isRoundTrip ? maxDrivableKm / 2 : maxDrivableKm;
}

/**
 * Calculate Haversine distance between two points
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate preference match score (0-100)
 */
function calculatePreferenceScore(
  tags: string[],
  preferences: TripPreference[]
): { score: number; reasons: string[] } {
  if (preferences.length === 0) {
    return { score: 50, reasons: ['Popular destination'] };
  }

  const reasons: string[] = [];
  let matchCount = 0;

  // Map preferences to tag keywords
  const preferenceKeywords: Record<TripPreference, string[]> = {
    scenic: ['scenic', 'nature', 'hiking', 'lakes', 'coastal', 'mountain'],
    family: ['family', 'iconic', 'beach', 'nature', 'camping'],
    budget: ['camping', 'nature', 'hiking', 'beach', 'city', 'budget', 'friendly'],
    foodie: ['foodie', 'wine', 'dining', 'culture', 'city'],
  };

  preferences.forEach(pref => {
    const keywords = preferenceKeywords[pref];
    const matches = tags.filter(tag => keywords.includes(tag));
    if (matches.length > 0) {
      matchCount += matches.length;
      reasons.push(`Great for ${pref} trips`);
    }
  });

  // Score based on match density
  const score = Math.min(100, 30 + (matchCount / preferences.length) * 35);
  return { score, reasons: reasons.length > 0 ? reasons : ['Interesting destination'] };
}

/**
 * Calculate cost breakdown for a destination
 */
function calculateCosts(
  distanceKm: number,
  config: AdventureConfig
): AdventureDestination['estimatedCosts'] {
  const { budget, days, travelers } = config;
  const accommodationType = config.accommodationType || 'moderate';
  const isRoundTrip = config.isRoundTrip !== false; // Default to true
  const nights = Math.max(0, days - 1);

  // Fuel: multiply by 2 for round trip, 1 for one-way
  const fuelMultiplier = isRoundTrip ? 2 : 1;
  const fuel = distanceKm * fuelMultiplier * COST_ESTIMATES.fuel.perKm;
  const accommodation = nights * COST_ESTIMATES.accommodation[accommodationType];
  const food = days * travelers * COST_ESTIMATES.food.perPersonPerDay;
  const total = fuel + accommodation + food;
  const remaining = Math.max(0, budget - total);

  return { fuel, accommodation, food, total, remaining };
}

/**
 * Find reachable destinations based on budget and preferences
 */
export async function findAdventureDestinations(
  config: AdventureConfig
): Promise<AdventureResult> {
  const maxDistance = calculateMaxDistance(config);
  const maxDriveHoursPerDay = config.maxDriveHoursPerDay || 8;

  // Filter destinations within range
  const reachableDestinations: AdventureDestination[] = [];

  for (const dest of POPULAR_DESTINATIONS) {
    const distanceKm = haversineDistance(
      config.origin.lat,
      config.origin.lng,
      dest.lat,
      dest.lng
    );

    // Road distance is typically 1.3x straight-line distance
    const roadDistanceKm = distanceKm * 1.3;

    // Check if within range
    if (roadDistanceKm > maxDistance) continue;

    // Check if drivable based on trip length (assuming 80km/h average)
    const driveHours = roadDistanceKm / 80;
    // For short trips (1-2 days): allow up to 80% driving time (it's a road trip!)
    // For longer trips: scale down to leave more time at destination
    const maxDrivingRatio = config.days <= 2 ? 0.8 : config.days <= 4 ? 0.6 : 0.4;
    if (driveHours > maxDriveHoursPerDay * config.days * maxDrivingRatio) continue;

    // Calculate costs
    const costs = calculateCosts(roadDistanceKm, config);

    // Skip if over budget
    if (costs.total > config.budget) continue;

    // Calculate preference score
    const { score, reasons } = calculatePreferenceScore(dest.tags, config.preferences);

    // Boost score based on value (remaining budget = spending money)
    const valueBoost = (costs.remaining / config.budget) * 20;
    const finalScore = Math.min(100, score + valueBoost);

    reachableDestinations.push({
      id: `dest-${dest.name.toLowerCase().replace(/\s+/g, '-')}`,
      location: {
        id: `loc-${dest.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: dest.name,
        lat: dest.lat,
        lng: dest.lng,
        type: 'destination',
      },
      name: dest.name,
      description: dest.description,
      category: dest.category,
      distanceKm: Math.round(roadDistanceKm),
      estimatedDriveHours: Math.round(driveHours * 10) / 10,
      estimatedCosts: {
        fuel: Math.round(costs.fuel),
        accommodation: Math.round(costs.accommodation),
        food: Math.round(costs.food),
        total: Math.round(costs.total),
        remaining: Math.round(costs.remaining),
      },
      score: Math.round(finalScore),
      matchReasons: reasons,
      imageUrl: dest.imageUrl,
      tags: dest.tags,
    });
  }

  // Sort by score descending
  reachableDestinations.sort((a, b) => b.score - a.score);

  return {
    config,
    maxReachableKm: Math.round(maxDistance),
    destinations: reachableDestinations.slice(0, 10), // Top 10
    calculatedAt: new Date(),
  };
}

/**
 * Get cost estimate breakdown text
 */
export function formatCostBreakdown(costs: AdventureDestination['estimatedCosts']): string {
  return `Gas: $${costs.fuel} | Hotels: $${costs.accommodation} | Food: $${costs.food}`;
}

// ==================== ADVENTURE BUDGET BUILDER ====================

/**
 * Build budget allocations from an adventure mode selection.
 *
 * Pure function — maps preferences + accommodation type to a budget profile
 * and distributes the total budget across gas/hotel/food/misc categories.
 *
 * Extracted from App.tsx handleAdventureSelect to keep App slim.
 */

const PREFERENCE_TO_PROFILE: Record<string, BudgetProfile> = {
  foodie: 'foodie',
  scenic: 'scenic',
  budget: 'balanced',
  family: 'balanced',
};

const DISCRETIONARY_WEIGHTS: Record<BudgetProfile, { hotel: number; food: number; misc: number }> = {
  balanced: { hotel: 45, food: 40, misc: 15 },
  foodie:   { hotel: 25, food: 60, misc: 15 },
  scenic:   { hotel: 50, food: 30, misc: 20 },
  custom:   { hotel: 45, food: 40, misc: 15 },
};

export interface AdventureBudgetResult {
  profile: BudgetProfile;
  gas: number;
  hotel: number;
  food: number;
  misc: number;
  total: number;
  weights: { gas: number; hotel: number; food: number; misc: number };
}

export function buildAdventureBudget(
  totalBudget: number,
  estimatedDistanceKm: number,
  preferences: TripPreference[],
  accommodationType: 'budget' | 'moderate' | 'comfort',
): AdventureBudgetResult {
  // Determine profile from preferences, fall back to accommodation type
  let profile: BudgetProfile = 'balanced';
  if (preferences.length > 0) {
    profile = PREFERENCE_TO_PROFILE[preferences[0]] || 'balanced';
  } else if (accommodationType === 'budget' || accommodationType === 'comfort') {
    profile = 'balanced';
  }

  const estimatedGasCost = Math.round(estimatedDistanceKm * 0.12);
  const remainingBudget = totalBudget - estimatedGasCost;

  const discWeights = DISCRETIONARY_WEIGHTS[profile];
  const hotel = Math.round(remainingBudget * (discWeights.hotel / 100));
  const food = Math.round(remainingBudget * (discWeights.food / 100));
  const misc = Math.round(remainingBudget * (discWeights.misc / 100));

  return {
    profile,
    gas: estimatedGasCost,
    hotel,
    food,
    misc,
    total: totalBudget,
    weights: {
      gas: Math.round((estimatedGasCost / totalBudget) * 100),
      hotel: Math.round((hotel / totalBudget) * 100),
      food: Math.round((food / totalBudget) * 100),
      misc: Math.round((misc / totalBudget) * 100),
    },
  };
}

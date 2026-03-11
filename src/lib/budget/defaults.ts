import type { TripBudget, BudgetProfile, BudgetWeights } from '../../types';

// ==================== BUDGET WEIGHT PROFILES ====================
// Each profile shifts where your money goes

export const BUDGET_PROFILES: Record<BudgetProfile, { weights: BudgetWeights; label: string; emoji: string; description: string }> = {
  balanced: {
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    label: 'Balanced',
    emoji: '⚖️',
    description: 'A little of everything. The sensible choice — until it isn\'t.',
  },
  foodie: {
    weights: { gas: 20, hotel: 20, food: 50, misc: 10 },
    label: 'Foodie',
    emoji: '🍜',
    description: 'Eat like royalty, sleep like a backpacker',
  },
  scenic: {
    weights: { gas: 35, hotel: 35, food: 20, misc: 10 },
    label: 'Scenic',
    emoji: '🏔️',
    description: 'Gas up, drive far, wake up somewhere worth it.',
  },
  custom: {
    weights: { gas: 25, hotel: 35, food: 30, misc: 10 },
    label: 'Custom',
    emoji: '🎛️',
    description: 'Your trip, your rules. Set priorities that actually match how you travel.',
  },
};

// Default budget values (CAD)
export const DEFAULT_BUDGET: TripBudget = {
  mode: 'open',
  allocation: 'flexible',
  profile: 'balanced',
  weights: BUDGET_PROFILES.balanced.weights,
  gas: 0,
  hotel: 0,
  food: 0,
  misc: 0,
  total: 0,
};

// ==================== HOTEL TIER PRESETS ====================
// Tier → base price per night (CAD). Regional multiplier applied on top.
export const HOTEL_TIERS = {
  budget:  { label: 'Budget',  emoji: '🛏️',  price: 90,  description: 'Motels & basic chains. Sleep well, spend the rest on adventures.' },
  regular: { label: 'Regular', emoji: '🏨',  price: 150, description: 'Comfortable hotels. The classic road trip standard.' },
  premium: { label: 'Premium', emoji: '✨',  price: 220, description: 'Boutique & upscale. Go bougie or go home.' },
} as const;

// Average cost estimates for planning
export const COST_ESTIMATES = {
  hotelPerNight: {
    budget: 100,
    moderate: 150,
    comfort: 200,
  },
  mealPerDay: {
    budget: 30,
    moderate: 50,
    comfort: 75,
  },
  gasPerKm: 0.12, // Rough estimate at $1.50/L and 8L/100km
};

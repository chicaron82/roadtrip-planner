// ==================== CHICHARON'S CHALLENGES ====================

import type { Location, Currency, TripSettings, Vehicle } from './core';

export type ChallengeDifficulty = 'cruiser' | 'road-warrior' | 'iron-driver' | 'gauntlet';

export interface TripChallenge {
  id: string;
  title: string;                     // "The Prairie Gauntlet"
  subtitle: string;                  // "Winnipeg → Toronto in 2 days"
  description: string;               // Flavor text / backstory
  difficulty: ChallengeDifficulty;
  emoji: string;                     // Card icon

  // Route data
  locations: Location[];             // Ordered: origin → waypoints → destination

  // Par stats (Chicharon's actual numbers)
  par: {
    totalDistanceKm: number;
    drivingDays: number;
    totalDriveHours: number;
    travelers: number;
    drivers: number;
    budget: number;                  // Total spend
    currency: Currency;
  };

  // Suggested settings for loading
  settings: Partial<TripSettings>;
  vehicle?: Vehicle;

  // Lore
  story?: string;                    // "It was -30°C and the highway was pure ice..."
  tips?: string[];                   // Chicharon's advice
  year?: number;                     // When the trip happened

  // Extended version link (e.g. Cruiser → Road Warrior variant of same route)
  extendedVersionId?: string;
}

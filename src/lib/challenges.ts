/**
 * Chicharon's Challenges
 *
 * Pre-loaded road trip experiences based on real trips.
 * Users can load a challenge and try to plan the same route
 * within the par time/budget — or beat it.
 *
 * 💚 Built with love by Aaron "Chicharon" 💚
 */

import type { TripChallenge, ChallengeDifficulty } from '../types';

// ==================== DIFFICULTY CONFIG ====================

export const DIFFICULTY_META: Record<ChallengeDifficulty, {
  label: string;
  emoji: string;
  color: string;        // Tailwind text color
  bgColor: string;      // Tailwind bg color
  borderColor: string;  // Tailwind border color
  description: string;
}> = {
  'cruiser': {
    label: 'Cruiser',
    emoji: '🟢',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Easy drive, scenic pace',
  },
  'road-warrior': {
    label: 'Road Warrior',
    emoji: '🟡',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Solid drive, tight but doable',
  },
  'iron-driver': {
    label: 'Iron Driver',
    emoji: '🔴',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Marathon sessions, not for the faint',
  },
  'gauntlet': {
    label: "Chicharon's Gauntlet",
    emoji: '💀',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'You sure about this?',
  },
};

// ==================== CHALLENGE DATA ====================
// TODO: Replace placeholders with Chicharon's real trips (weekend data drop)

export const CHALLENGES: TripChallenge[] = [
  {
    id: 'challenge-placeholder-1',
    title: 'The Weekend Cruise',
    subtitle: 'Coming Soon',
    description: "Chicharon's chill weekend getaway. Details dropping soon.",
    difficulty: 'cruiser',
    emoji: '🏖️',
    locations: [],
    par: {
      totalDistanceKm: 0,
      drivingDays: 1,
      totalDriveHours: 0,
      travelers: 2,
      drivers: 1,
      budget: 0,
      currency: 'CAD',
    },
    settings: {},
    tips: ['Real data coming soon!'],
  },
  {
    id: 'challenge-placeholder-2',
    title: 'The Long Haul',
    subtitle: 'Coming Soon',
    description: "One of Chicharon's epic cross-country pushes. Stay tuned.",
    difficulty: 'road-warrior',
    emoji: '🛣️',
    locations: [],
    par: {
      totalDistanceKm: 0,
      drivingDays: 2,
      totalDriveHours: 0,
      travelers: 4,
      drivers: 2,
      budget: 0,
      currency: 'CAD',
    },
    settings: {},
    tips: ['Real data coming soon!'],
  },
  {
    id: 'challenge-placeholder-3',
    title: 'The Gauntlet',
    subtitle: 'Coming Soon',
    description: "The one that made Chicharon question everything. Only the brave apply.",
    difficulty: 'gauntlet',
    emoji: '💀',
    locations: [],
    par: {
      totalDistanceKm: 0,
      drivingDays: 3,
      totalDriveHours: 0,
      travelers: 2,
      drivers: 1,
      budget: 0,
      currency: 'CAD',
    },
    settings: {},
    story: 'The full story drops when the data does...',
    tips: ['Real data coming soon!'],
  },
];

// ==================== HELPERS ====================

/**
 * Get all challenges sorted by difficulty (easiest first)
 */
export function getChallenges(): TripChallenge[] {
  const order: ChallengeDifficulty[] = ['cruiser', 'road-warrior', 'iron-driver', 'gauntlet'];
  return [...CHALLENGES].sort(
    (a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty),
  );
}

/**
 * Get a challenge by ID
 */
export function getChallengeById(id: string): TripChallenge | undefined {
  return CHALLENGES.find(c => c.id === id);
}

/**
 * Check if a challenge has real data loaded (not a placeholder)
 */
export function isChallengeReady(challenge: TripChallenge): boolean {
  return challenge.locations.length >= 2 && challenge.par.totalDistanceKm > 0;
}

/**
 * Format par stats for display
 */
export function formatParStats(challenge: TripChallenge): string {
  if (!isChallengeReady(challenge)) return 'Details coming soon';
  const { par } = challenge;
  const parts = [
    `${Math.round(par.totalDistanceKm)} km`,
    `${par.drivingDays} day${par.drivingDays !== 1 ? 's' : ''}`,
    `${par.totalDriveHours}h driving`,
  ];
  if (par.budget > 0) {
    parts.push(`$${par.budget} ${par.currency}`);
  }
  return parts.join(' · ');
}

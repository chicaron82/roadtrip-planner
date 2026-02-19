/**
 * Chicharon's Challenges
 *
 * Pre-loaded road trip experiences based on real trips by Aaron "Chicharon".
 * Users can load a challenge and try to match the route pacing —
 * same stops, same driving days, same daily hours behind the wheel.
 *
 * ⚠️  Budget figures are historical trivia only — gas/hotel prices vary by era
 *     and can't be fairly compared. The real competition is route pacing.
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

/**
 * The main 3 challenge cards shown in the UI.
 * Sorted by difficulty in getChallenges().
 */
export const CHALLENGES: TripChallenge[] = [

  // ──────────────────────────────────────────────────────────────
  // 🟢 CRUISER — Canadian EuroTrip (Aug 2025)
  // Winnipeg → Sault Ste. Marie → Burlington (Euro Loop + Niagara) → Sault Ste. Marie → Winnipeg
  // 6 days · ~4,896 km · ~60h driving · 4 travelers · 2 drivers
  // ──────────────────────────────────────────────────────────────
  {
    id: 'challenge-cet-2025',
    title: 'The Canadian EuroTrip',
    subtitle: 'Winnipeg → Burlington Loop · 6 Days',
    description:
      'European towns. Canadian highways. Zero flights. We drove to "London," "Dublin," "Brussels," "Paris," and back — all without leaving Ontario. A bucketed-list road trip disguised as a geography lesson.',
    difficulty: 'cruiser',
    emoji: '🗺️',
    year: 2025,
    extendedVersionId: 'challenge-cet-extended-2025',

    locations: [
      { id: 'cet-01', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'origin' },
      { id: 'cet-02', name: 'Beausejour, MB', address: 'Beausejour, Manitoba', lat: 50.0617, lng: -96.5217, type: 'waypoint' },
      { id: 'cet-03', name: 'Dryden, ON', address: 'Dryden, Ontario', lat: 49.7817, lng: -92.8377, type: 'waypoint' },
      { id: 'cet-04', name: 'Kakabeka Falls, ON', address: 'Kakabeka Falls, Ontario', lat: 48.4022, lng: -89.6233, type: 'waypoint' },
      { id: 'cet-05', name: 'Sault Ste. Marie, ON', address: 'Sault Ste. Marie, Ontario', lat: 46.5136, lng: -84.3358, type: 'waypoint' },
      { id: 'cet-06', name: 'Parry Sound, ON', address: 'Parry Sound, Ontario', lat: 45.3442, lng: -80.0353, type: 'waypoint' },
      { id: 'cet-07', name: 'Burlington, ON', address: 'Burlington, Ontario', lat: 43.3255, lng: -79.7990, type: 'waypoint' },
      { id: 'cet-08', name: 'London, ON', address: 'London, Ontario', lat: 42.9849, lng: -81.2453, type: 'waypoint' },
      { id: 'cet-09', name: 'Niagara Falls, ON', address: 'Niagara Falls, Ontario', lat: 43.0962, lng: -79.0849, type: 'waypoint' },
      { id: 'cet-10', name: 'Sault Ste. Marie, ON', address: 'Sault Ste. Marie, Ontario', lat: 46.5136, lng: -84.3358, type: 'waypoint' },
      { id: 'cet-11', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'destination' },
    ],

    par: {
      totalDistanceKm: 4896,
      drivingDays: 5,       // Day 4 was a free day in Burlington
      totalDriveHours: 60,  // 15h40m + 9h + ~8h + 9h + 18h30m
      travelers: 4,
      drivers: 2,
      budget: 1305,         // Historical only — gas + hotels, Aug 2025 CAD prices
      currency: 'CAD',
    },

    settings: {
      isRoundTrip: false,   // Winnipeg → ... → Winnipeg (explicit, not mirrored)
      numTravelers: 4,
      numDrivers: 2,
      maxDriveHours: 10,    // Real pace: ~10h/day avg. Days 1 & 6 are forced-single legs anyway.
    },

    story:
      '3:30 AM. The city is asleep. Four people, one car, and the dumbest/greatest idea we ever had: drive to "Europe" — except all the towns are in Ontario. We hit London, Dublin, Brussels, Paris, Vienna, and Copenhagen in one day. Ate Covent Garden Market leftovers somewhere near Vienna. Worth every kilometre.',

    tips: [
      'Depart by 3:30 AM on Day 1 — that Winnipeg → Sault Ste. Marie leg is brutal and you want daylight through Northern Ontario.',
      'Kakabeka Falls is a mandatory 30-min stop. Trust.',
      'The Euro Town Loop works best as an early morning departure out of Burlington — you want to hit London by 10 AM.',
      'Complimentary hotel breakfast on Day 2 is non-negotiable. You earned it.',
      'Day 4 in Burlington is your breath. Use it.',
      'Day 6 home run (Sault → Winnipeg) is 18.5h. Two drivers are not optional — they are survival.',
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // 🔴 IRON DRIVER — End of Summer (Aug–Sep 2019)
  // Winnipeg → OKC → Houston → Texas Parks → St. Louis (Route 66) → Niagara → Chicago → Winnipeg
  // 10 days · ~8,500 km · ~87h driving · 4 travelers · 2 drivers
  // ──────────────────────────────────────────────────────────────
  {
    id: 'challenge-eos-2019',
    title: 'End of Summer',
    subtitle: 'Winnipeg → US South Loop · 10 Days',
    description:
      'Oklahoma, Texas, Missouri, Ontario, Illinois — one last blowout before the cold sets in. Route 66, the Gateway Arch, natural swimming holes in Texas, and a Niagara Falls finale. No plan survives contact with the road, but the road always wins.',
    difficulty: 'iron-driver',
    emoji: '☀️',
    year: 2019,

    locations: [
      { id: 'eos-01', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'origin' },
      { id: 'eos-02', name: 'Fargo, ND', address: 'Fargo, North Dakota', lat: 46.8772, lng: -96.7898, type: 'waypoint' },
      { id: 'eos-03', name: 'Oklahoma City, OK', address: 'Oklahoma City, Oklahoma', lat: 35.4676, lng: -97.5164, type: 'waypoint' },
      { id: 'eos-04', name: 'Houston, TX', address: 'Houston, Texas', lat: 29.7604, lng: -95.3698, type: 'waypoint' },
      { id: 'eos-05', name: 'Georgetown, TX', address: 'Georgetown, Texas', lat: 30.6330, lng: -97.6779, type: 'waypoint' },
      { id: 'eos-06', name: 'Bend, TX', address: 'Bend, Texas', lat: 31.0700, lng: -98.4600, type: 'waypoint' },
      { id: 'eos-07', name: 'Longview, TX', address: 'Longview, Texas', lat: 32.5007, lng: -94.7405, type: 'waypoint' },
      { id: 'eos-08', name: 'St. Louis, MO', address: 'St. Louis, Missouri', lat: 38.6270, lng: -90.1994, type: 'waypoint' },
      { id: 'eos-09', name: 'Niagara Falls, ON', address: 'Niagara Falls, Ontario', lat: 43.0962, lng: -79.0849, type: 'waypoint' },
      { id: 'eos-10', name: 'Chicago, IL', address: 'Chicago, Illinois', lat: 41.8781, lng: -87.6298, type: 'waypoint' },
      { id: 'eos-11', name: 'Albertville, MN', address: 'Albertville, Minnesota', lat: 45.2338, lng: -93.6549, type: 'waypoint' },
      { id: 'eos-12', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'destination' },
    ],

    par: {
      totalDistanceKm: 8500,
      drivingDays: 9,       // 1 full rest day in OKC; most days had significant driving
      totalDriveHours: 87,  // Sum of all legs per docs
      travelers: 4,
      drivers: 2,
      budget: 1500,         // Historical only — mixed USD/CAD expenses, Aug 2019 prices
      currency: 'CAD',
    },

    settings: {
      isRoundTrip: false,
      numTravelers: 4,
      numDrivers: 2,
      maxDriveHours: 8,     // Real pace: ~8.7h/day avg across 10 driving days
    },

    story:
      'We left Winnipeg at 9 PM on a Thursday and didn\'t stop moving for 17 hours. First proper stop: Walmart Fargo at 2 AM to stock up on road trip food. Second stop: Pops 66 Soda Ranch in Arcadia, OK — a 66-foot pop bottle on Route 66, because of course. Texas gave us natural swimming holes, Gorman Falls, and Dallas margaritas. The Gateway Arch at golden hour. Then somehow we backtracked to Niagara Falls because the trip wasn\'t wild enough. Chicago drained what was left of the budget. Albertville malls finished the job. No regrets.',

    tips: [
      'Depart at night — you want to hit the US border in the early hours and be in OKC by afternoon the next day.',
      'Stock up at the Walmart in Fargo (4731 13th Ave S) — it\'s the last big stop before a long stretch.',
      'Follow Hwy 75 from Sioux City to Omaha for a scenic detour, then merge back on I-29.',
      'Blue Hole Regional Park in Georgetown, TX ($10) is worth every cent. Arrive early — it fills up fast.',
      'The Route 66 stretch through Missouri runs parallel to I-44. Keep an eye out for signs — it\'s driveable, not just scenic.',
      'Niagara Falls on the Ontario side is underrated. Do the Canadian side.',
      'Albertville, MN has premium outlets. Budget accordingly or don\'t — same result.',
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // 💀 CHICHARON'S GAUNTLET — Eastern US (Oct 2013)
  // Winnipeg → Cleveland → DC → Philadelphia → NYC → Atlantic City → Montreal → Ottawa → Toronto → Niagara → Milwaukee → Winnipeg
  // 12 days · ~6,768 km · ~68h driving · 3 travelers · 3 drivers (all drivers)
  // ──────────────────────────────────────────────────────────────
  {
    id: 'challenge-eus-2013',
    title: 'The Eastern US Gauntlet',
    subtitle: 'Winnipeg → East Coast Loop · 12 Days',
    description:
      'The OG. Before there were plans, there was just a car, three people, and the entire eastern seaboard. Rock and Roll Hall of Fame, the White House, Rocky steps, Times Square, Atlantic City casinos, Montreal, the CN Tower EdgeWalk. If it was worth driving to, we drove to it.',
    difficulty: 'gauntlet',
    emoji: '🗽',
    year: 2013,

    locations: [
      { id: 'eus-01', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'origin' },
      { id: 'eus-02', name: 'Cleveland, OH', address: 'Cleveland, Ohio', lat: 41.4993, lng: -81.6944, type: 'waypoint' },
      { id: 'eus-03', name: 'Washington, DC', address: 'Washington, District of Columbia', lat: 38.9072, lng: -77.0369, type: 'waypoint' },
      { id: 'eus-04', name: 'Philadelphia, PA', address: 'Philadelphia, Pennsylvania', lat: 39.9526, lng: -75.1652, type: 'waypoint' },
      { id: 'eus-05', name: 'New York, NY', address: 'New York, New York', lat: 40.7128, lng: -74.0060, type: 'waypoint' },
      { id: 'eus-06', name: 'Atlantic City, NJ', address: 'Atlantic City, New Jersey', lat: 39.3643, lng: -74.4229, type: 'waypoint' },
      { id: 'eus-07', name: 'Woodbridge, NJ', address: 'Woodbridge, New Jersey', lat: 40.5576, lng: -74.2846, type: 'waypoint' },
      { id: 'eus-08', name: 'Montreal, QC', address: 'Montréal, Québec', lat: 45.5017, lng: -73.5673, type: 'waypoint' },
      { id: 'eus-09', name: 'Ottawa, ON', address: 'Ottawa, Ontario', lat: 45.4215, lng: -75.6972, type: 'waypoint' },
      { id: 'eus-10', name: 'Toronto, ON', address: 'Toronto, Ontario', lat: 43.6532, lng: -79.3832, type: 'waypoint' },
      { id: 'eus-11', name: 'Niagara Falls, ON', address: 'Niagara Falls, Ontario', lat: 43.0962, lng: -79.0849, type: 'waypoint' },
      { id: 'eus-12', name: 'Milwaukee, WI', address: 'Milwaukee, Wisconsin', lat: 43.0389, lng: -87.9065, type: 'waypoint' },
      { id: 'eus-13', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'destination' },
    ],

    par: {
      totalDistanceKm: 6768,
      drivingDays: 10,      // 2 full city days in NYC and Montreal; rest involved driving
      totalDriveHours: 68,  // Sum of all documented legs
      travelers: 3,
      drivers: 3,           // All 3 drove — everyone pulled shifts
      budget: 1900,         // Historical only — mixed USD/CAD, Oct 2013 prices
      currency: 'CAD',
    },

    settings: {
      isRoundTrip: false,
      numTravelers: 3,
      numDrivers: 3,
      maxDriveHours: 6,     // Real pace: ~6h/day avg. The WPG→Cleveland 19h single leg is unfurcatable anyway.
      avoidBorders: false,  // This trip IS border crossings
    },

    story:
      'October 2013. Three guys. No real plan except a list of cities and a departure time. We drove from Winnipeg to Cleveland overnight — nearly 19 hours straight. Rock and Roll Hall of Fame when it opened. Then DC, then Philly for the Rocky Statue and a real cheesesteak. New York for two days. Atlantic City for the casinos. Then back to Canada through Montreal for poutine and the casino there too. Ottawa at Parliament Hill. Toronto EdgeWalk on the CN Tower. Niagara Falls. Milwaukee for the Safe House restaurant. Then home. 12 days. 6,768 km. Three people who will never, ever do that again — except they definitely would.',

    tips: [
      'The Winnipeg → Cleveland overnight push (18h58m) requires everyone to be a driver. Non-negotiable.',
      'Cross into the US early — border delays at peak hours will crush your schedule.',
      'Philadelphia Museum of Art + Rocky Statue is a short detour. The cheesesteak at Pat\'s or Geno\'s is mandatory.',
      'NYC: Two days minimum. One is not enough.',
      'The Hampton Inn near Madison Square Garden is expensive but central — worth it for NYC.',
      'Niagara Falls → Milwaukee is a long single-day push (9h12m). Fuel up before you leave Ontario.',
      'Milwaukee Safe House restaurant: you need a password to get in. Look it up before you go.',
      'This is the Gauntlet. Respect the kilometres.',
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// Hidden extended challenges — not shown in the main card strip,
// but accessible by ID via getChallengeById().
// ──────────────────────────────────────────────────────────────

const EXTENDED_CHALLENGES: TripChallenge[] = [

  // 🟡 ROAD WARRIOR — Canadian Euro Trip Extended (Aug 2025)
  // Same base as EuroTrip but adds Montreal, Ottawa, CN Tower EdgeWalk, Niagara dinner cruise
  // 7 days · ~5,836 km · ~71h driving · 4 travelers · 2 drivers
  {
    id: 'challenge-cet-extended-2025',
    title: 'Canadian EuroTrip: Extended Cut',
    subtitle: 'Winnipeg → Burlington → Montreal → Sault Ste. Marie Loop · 7 Days',
    description:
      'Everything in the EuroTrip — plus Montreal for a 5-course dinner cruise on the St. Lawrence, Parliament Hill in Ottawa, and the CN Tower EdgeWalk in Toronto. Same crew, one more day, considerably more kilometres.',
    difficulty: 'road-warrior',
    emoji: '🏙️',
    year: 2025,

    locations: [
      { id: 'cete-01', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'origin' },
      { id: 'cete-02', name: 'Beausejour, MB', address: 'Beausejour, Manitoba', lat: 50.0617, lng: -96.5217, type: 'waypoint' },
      { id: 'cete-03', name: 'Dryden, ON', address: 'Dryden, Ontario', lat: 49.7817, lng: -92.8377, type: 'waypoint' },
      { id: 'cete-04', name: 'Kakabeka Falls, ON', address: 'Kakabeka Falls, Ontario', lat: 48.4022, lng: -89.6233, type: 'waypoint' },
      { id: 'cete-05', name: 'Sault Ste. Marie, ON', address: 'Sault Ste. Marie, Ontario', lat: 46.5136, lng: -84.3358, type: 'waypoint' },
      { id: 'cete-06', name: 'Parry Sound, ON', address: 'Parry Sound, Ontario', lat: 45.3442, lng: -80.0353, type: 'waypoint' },
      { id: 'cete-07', name: 'Burlington, ON', address: 'Burlington, Ontario', lat: 43.3255, lng: -79.7990, type: 'waypoint' },
      { id: 'cete-08', name: 'London, ON', address: 'London, Ontario', lat: 42.9849, lng: -81.2453, type: 'waypoint' },
      { id: 'cete-09', name: 'Niagara Falls, ON', address: 'Niagara Falls, Ontario', lat: 43.0962, lng: -79.0849, type: 'waypoint' },
      { id: 'cete-10', name: 'Toronto, ON', address: 'Toronto, Ontario', lat: 43.6532, lng: -79.3832, type: 'waypoint' },
      { id: 'cete-11', name: 'Montreal, QC', address: 'Montréal, Québec', lat: 45.5017, lng: -73.5673, type: 'waypoint' },
      { id: 'cete-12', name: 'Ottawa, ON', address: 'Ottawa, Ontario', lat: 45.4215, lng: -75.6972, type: 'waypoint' },
      { id: 'cete-13', name: 'Sudbury, ON', address: 'Sudbury, Ontario', lat: 46.4920, lng: -80.9930, type: 'waypoint' },
      { id: 'cete-14', name: 'Sault Ste. Marie, ON', address: 'Sault Ste. Marie, Ontario', lat: 46.5136, lng: -84.3358, type: 'waypoint' },
      { id: 'cete-15', name: 'Winnipeg, MB', address: 'Winnipeg, Manitoba', lat: 49.8951, lng: -97.1384, type: 'destination' },
    ],

    par: {
      totalDistanceKm: 5836,
      drivingDays: 6,       // Day 4 (Toronto day) was local only
      totalDriveHours: 71,  // 15h40m + 9h + ~8h + ~3h + 7h + 10h + 18h30m
      travelers: 4,
      drivers: 2,
      budget: 1800,         // Historical only — Aug 2025 CAD prices
      currency: 'CAD',
    },

    settings: {
      isRoundTrip: false,
      numTravelers: 4,
      numDrivers: 2,
      maxDriveHours: 16,
    },

    story:
      'The Extended Cut adds a Montreal night with a 5-course dinner cruise on the St. Lawrence — fancy enough that people dressed up after 5 days in a car. Day 6 is the beast: Montreal → Ottawa → Sudbury → Sault Ste. Marie, 960 km in one shot. Then the same 3:30 AM departure home.',

    tips: [
      'Everything from the base EuroTrip applies. Then add: book the Montreal dinner cruise WAY in advance.',
      'The Old Port in Montreal is worth an extra hour if you arrive early enough.',
      'Ottawa → Sudbury → Sault Ste. Marie on Day 6 is a 10h push. This is not a sightseeing day — it\'s a survive-and-land day.',
      'CN Tower EdgeWalk: book as early as possible. Slots go fast.',
    ],
  },
];

// ==================== HELPERS ====================

/**
 * Get all main challenges sorted by difficulty (easiest first).
 * Extended / hidden variants are NOT included here.
 */
export function getChallenges(): TripChallenge[] {
  const order: ChallengeDifficulty[] = ['cruiser', 'road-warrior', 'iron-driver', 'gauntlet'];
  return [...CHALLENGES].sort(
    (a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty),
  );
}

/**
 * Get any challenge by ID — including hidden extended variants.
 */
export function getChallengeById(id: string): TripChallenge | undefined {
  return [...CHALLENGES, ...EXTENDED_CHALLENGES].find(c => c.id === id);
}

/**
 * Check if a challenge has real data loaded (not a placeholder).
 */
export function isChallengeReady(challenge: TripChallenge): boolean {
  return challenge.locations.length >= 2 && challenge.par.totalDistanceKm > 0;
}

/**
 * Format par stats for display — pacing-focused.
 * Budget is intentionally excluded here (it's era-specific and unfair to compare).
 */
export function formatParStats(challenge: TripChallenge): string {
  if (!isChallengeReady(challenge)) return 'Details coming soon';
  const { par } = challenge;
  return [
    `${par.totalDistanceKm.toLocaleString()} km`,
    `${par.drivingDays} driving day${par.drivingDays !== 1 ? 's' : ''}`,
    `~${par.totalDriveHours}h behind the wheel`,
  ].join(' · ');
}

/**
 * Format the historical budget as a contextual footnote (not a competitive metric).
 */
export function formatHistoricalCost(challenge: TripChallenge): string {
  if (challenge.par.budget <= 0) return '';
  return `~$${challenge.par.budget.toLocaleString()} ${challenge.par.currency} (${challenge.year ?? '?'}, tracked expenses only)`;
}

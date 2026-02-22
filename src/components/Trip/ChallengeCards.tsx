/**
 * ChallengeCards — Chicharon's Challenges selector
 *
 * Displays pre-loaded road trip challenges as a horizontal scrollable
 * card strip. Each card shows difficulty, Chicharon's par stats, and a
 * "Use as Inspiration" button.
 *
 * Users can set a custom starting city — the challenge keeps all interior
 * waypoints exactly as-is, but swaps the origin/destination with their city.
 * Par stats are always Chicharon's real numbers (measured from Winnipeg).
 *
 * If a challenge has an extendedVersionId, a secondary "Try Extended Route"
 * CTA appears — loading the harder variant without adding an extra card.
 */

import { useState, useEffect } from 'react';
import { Trophy, Lock, ChevronRight, MapPin } from 'lucide-react';
import type { TripChallenge, Location } from '../../types';
import { LocationSearchInput } from './LocationSearchInput';
import {
  getChallenges,
  getChallengeById,
  isChallengeReady,
  formatParStats,
  formatHistoricalCost,
  DIFFICULTY_META,
} from '../../lib/challenges';

interface ChallengeCardsProps {
  onSelectChallenge: (challenge: TripChallenge) => void;
  /** Current trip origin from Step 1, if set. Auto-syncs unless user overrides. */
  initialOrigin?: Partial<Location> | null;
}

/** Winnipeg — Chicharon's home base and canonical par origin */
const WINNIPEG_LAT = 49.8951;
const WINNIPEG_LNG = -97.1384;

function isWinnipegCoords(lat: number, lng: number): boolean {
  return Math.abs(lat - WINNIPEG_LAT) < 0.05 && Math.abs(lng - WINNIPEG_LNG) < 0.05;
}

/**
 * Replace origin + destination entries with the user's city.
 * All interior waypoints stay exactly as Chicharon drove them.
 */
function adaptChallengeForOrigin(
  challenge: TripChallenge,
  userOrigin: Partial<Location>
): TripChallenge {
  if (!userOrigin.lat || !userOrigin.lng || !userOrigin.name) return challenge;
  const newLocations = challenge.locations.map(loc =>
    loc.type === 'origin' || loc.type === 'destination'
      ? {
          ...loc,
          name: userOrigin.name!,
          address: userOrigin.address || userOrigin.name!,
          lat: userOrigin.lat!,
          lng: userOrigin.lng!,
        }
      : loc
  );
  return { ...challenge, locations: newLocations };
}

export function ChallengeCards({ onSelectChallenge, initialOrigin }: ChallengeCardsProps) {
  const challenges = getChallenges();

  // User's custom start city — auto-syncs with Step 1 origin unless manually overridden
  const [userOrigin, setUserOrigin] = useState<Partial<Location> | null>(null);
  const [hasManualOverride, setHasManualOverride] = useState(false);

  useEffect(() => {
    if (!hasManualOverride && initialOrigin?.lat && initialOrigin.lat !== 0 && initialOrigin.name) {
      setUserOrigin(initialOrigin);
    }
  }, [initialOrigin, hasManualOverride]);

  const handleOriginSelect = (loc: Partial<Location>) => {
    setHasManualOverride(true);
    setUserOrigin(loc.lat && loc.lat !== 0 ? loc : null);
  };

  const notFromWinnipeg = !!(
    userOrigin?.lat &&
    userOrigin.lat !== 0 &&
    !isWinnipegCoords(userOrigin.lat, userOrigin.lng ?? 0)
  );

  const handleLoad = (challenge: TripChallenge) => {
    const adapted = notFromWinnipeg && userOrigin
      ? adaptChallengeForOrigin(challenge, userOrigin)
      : challenge;
    onSelectChallenge(adapted);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Chicharon's Challenges
        </h3>
        <span className="text-xs text-muted-foreground">— Real trips. Make them yours.</span>
      </div>

      {/* Starting from selector */}
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-amber-500/70 flex-shrink-0" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Starting from:</span>
        <div className="flex-1 min-w-0">
          <LocationSearchInput
            value={userOrigin?.name || ''}
            onSelect={handleOriginSelect}
            placeholder="Winnipeg, MB (Chicharon's home base)"
            className="text-xs"
          />
        </div>
      </div>

      {/* Card strip */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory no-scrollbar touch-pan-y">
        {challenges.map((challenge) => {
          const meta = DIFFICULTY_META[challenge.difficulty];
          const ready = isChallengeReady(challenge);
          const extendedChallenge = challenge.extendedVersionId
            ? getChallengeById(challenge.extendedVersionId)
            : undefined;
          const historicalCost = ready ? formatHistoricalCost(challenge) : '';

          return (
            <div
              key={challenge.id}
              className={`
                flex-shrink-0 w-60 snap-start rounded-xl border-2 p-3 text-left transition-all
                ${ready
                  ? `${meta.bgColor} ${meta.borderColor}`
                  : 'bg-gray-50 border-gray-200 opacity-60'
                }
              `}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{challenge.emoji}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.color} border ${meta.borderColor}`}>
                  {meta.emoji} {meta.label}
                </span>
              </div>

              {/* Title */}
              <div className="font-semibold text-sm text-foreground leading-tight">
                {challenge.title}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {challenge.subtitle}
              </div>

              {/* Par stats */}
              <div className="mt-2 text-xs text-muted-foreground">
                {ready ? (
                  <>
                    <div className="font-medium text-foreground mb-1">
                      Chicharon's par:
                      {notFromWinnipeg && (
                        <span className="ml-1 font-normal opacity-60">(from Winnipeg)</span>
                      )}
                    </div>
                    <div>{formatParStats(challenge)}</div>
                    <div className="mt-1">
                      👥 {challenge.par.travelers} travelers · 🚗 {challenge.par.drivers} driver{challenge.par.drivers !== 1 ? 's' : ''}
                    </div>
                    {historicalCost && (
                      <div className="mt-1 italic opacity-70">
                        💸 {historicalCost}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <Lock className="h-3 w-3" />
                    <span>Details dropping soon</span>
                  </div>
                )}
              </div>

              {/* Primary CTA */}
              {ready && (
                <button
                  onClick={() => handleLoad(challenge)}
                  className={`mt-3 w-full flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-2 rounded-lg transition-all hover:shadow-sm ${meta.bgColor} ${meta.color} border ${meta.borderColor} hover:brightness-95`}
                >
                  Use as Inspiration <ChevronRight className="h-3 w-3" />
                </button>
              )}

              {/* Secondary CTA — Extended Route (only on cards that have one) */}
              {ready && extendedChallenge && isChallengeReady(extendedChallenge) && (
                <button
                  onClick={() => handleLoad(extendedChallenge)}
                  className="mt-1.5 w-full flex items-center justify-center gap-1 text-xs font-medium py-1 px-2 rounded-lg text-muted-foreground hover:text-foreground border border-dashed border-current/30 hover:border-current/60 transition-all"
                >
                  ⬆️ Try Extended Route <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground italic">
        Real trips, real roads — loaded as inspiration for your own adventure. 🔥
      </p>
    </div>
  );
}

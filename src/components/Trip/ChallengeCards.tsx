/**
 * ChallengeCards — Chicharon's Challenge selector
 *
 * Displays pre-loaded road trip challenges as a horizontal scrollable
 * card strip. Each card shows difficulty, par stats, and a load button.
 *
 * If a challenge has an extendedVersionId, a secondary "Try Extended Route"
 * CTA appears — loading the harder variant without adding an extra card.
 */

import { Trophy, Lock, ChevronRight } from 'lucide-react';
import type { TripChallenge } from '../../types';
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
}

export function ChallengeCards({ onSelectChallenge }: ChallengeCardsProps) {
  const challenges = getChallenges();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Chicharon's Challenges
        </h3>
        <span className="text-xs text-muted-foreground">— Can you match the pace?</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory no-scrollbar">
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

              {/* Par stats or coming soon */}
              <div className="mt-2 text-xs text-muted-foreground">
                {ready ? (
                  <>
                    <div className="font-medium text-foreground mb-1">Par:</div>
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
                  onClick={() => onSelectChallenge(challenge)}
                  className={`mt-3 w-full flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-2 rounded-lg transition-all hover:shadow-sm ${meta.bgColor} ${meta.color} border ${meta.borderColor} hover:brightness-95`}
                >
                  Accept Challenge <ChevronRight className="h-3 w-3" />
                </button>
              )}

              {/* Secondary CTA — Extended Route (only on cards that have one) */}
              {ready && extendedChallenge && isChallengeReady(extendedChallenge) && (
                <button
                  onClick={() => onSelectChallenge(extendedChallenge)}
                  className="mt-1.5 w-full flex items-center justify-center gap-1 text-xs font-medium py-1 px-2 rounded-lg text-muted-foreground hover:text-foreground border border-dashed border-current/30 hover:border-current/60 transition-all"
                >
                  ⬆️ Try Extended Route <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Story teaser */}
      <p className="text-xs text-muted-foreground italic">
        Real trips. Real stats. Can you match Chicharon's pace? 🔥
      </p>
    </div>
  );
}

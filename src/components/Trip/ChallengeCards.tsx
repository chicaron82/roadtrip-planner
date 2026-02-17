/**
 * ChallengeCards — Chicharon's Challenge selector
 *
 * Displays pre-loaded road trip challenges as a horizontal scrollable
 * card strip. Each card shows difficulty, par stats, and a load button.
 */

import { Trophy, Lock, ChevronRight } from 'lucide-react';
import type { TripChallenge } from '../../types';
import {
  getChallenges,
  isChallengeReady,
  formatParStats,
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
        <span className="text-xs text-muted-foreground">— Can you match the par?</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory no-scrollbar">
        {challenges.map((challenge) => {
          const meta = DIFFICULTY_META[challenge.difficulty];
          const ready = isChallengeReady(challenge);

          return (
            <button
              key={challenge.id}
              onClick={() => ready && onSelectChallenge(challenge)}
              disabled={!ready}
              className={`
                flex-shrink-0 w-56 snap-start rounded-xl border-2 p-3 text-left transition-all
                ${ready
                  ? `${meta.bgColor} ${meta.borderColor} hover:shadow-md hover:scale-[1.02] cursor-pointer`
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
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
                    <div className="mt-1 text-xs">
                      👥 {challenge.par.travelers} travelers · 🚗 {challenge.par.drivers} driver{challenge.par.drivers !== 1 ? 's' : ''}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <Lock className="h-3 w-3" />
                    <span>Details dropping soon</span>
                  </div>
                )}
              </div>

              {/* Load prompt */}
              {ready && (
                <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                  Accept Challenge <ChevronRight className="h-3 w-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Story teaser */}
      <p className="text-xs text-muted-foreground italic">
        Real trips. Real stats. Can you beat Chicharon's time? 🔥
      </p>
    </div>
  );
}

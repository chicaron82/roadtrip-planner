import { useState } from 'react';
import { Sparkles, MapPin, Clock, DollarSign, ChevronRight, Compass, ArrowLeft } from 'lucide-react';
import type { AdventureDestination, TripChallenge, Location } from '../../../types';
import { cn } from '../../../lib/utils';
import { ChallengeCards } from './ChallengeCards';

interface AdventureResultsPanelProps {
  isCalculating: boolean;
  destinations: AdventureDestination[];
  hasSearched: boolean;
  isRoundTrip: boolean;
  days: number;
  onSelectDestination: (dest: AdventureDestination) => void;
  origin: Location | null;
  onSelectChallenge: (challenge: TripChallenge) => void;
}

const CATEGORY_EMOJI: Record<AdventureDestination['category'], string> = {
  city: '🏙️',
  nature: '🌲',
  beach: '🏖️',
  mountain: '⛰️',
  historic: '🏛️',
};

export function AdventureResultsPanel({
  isCalculating,
  destinations,
  hasSearched,
  isRoundTrip,
  days,
  onSelectDestination,
  origin,
  onSelectChallenge,
}: AdventureResultsPanelProps) {
  const [selectedDest, setSelectedDest] = useState<AdventureDestination | null>(null);

  const challengesSection = origin && origin.lat !== 0 ? (
    <div className="border-t border-purple-100 pt-4 mt-4">
      <ChallengeCards onSelectChallenge={onSelectChallenge} initialOrigin={origin} />
    </div>
  ) : null;

  if (isCalculating) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center py-12">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-purple-500 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-gray-500">Finding adventures...</p>
        </div>
      </div>
    );
  }

  // ── Confirmation surface ──────────────────────────────────────────────────
  if (selectedDest) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col">
        <button
          onClick={() => setSelectedDest(null)}
          className="flex items-center gap-1 text-sm text-purple-500 hover:text-purple-700 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to results
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Found it.</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Ready to make it real?
          </h2>
          <p className="text-sm text-gray-500 mb-6">Here's what MEE has planned for you.</p>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{CATEGORY_EMOJI[selectedDest.category]}</span>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedDest.name}</h3>
                {selectedDest.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{selectedDest.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-purple-400" />
                {days} day{days !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-purple-400" />
                ~${selectedDest.estimatedCosts.total.toLocaleString()} estimated
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-purple-400" />
                {selectedDest.estimatedDriveHours}h drive
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs border-t border-purple-100 pt-3">
              <div className="text-center">
                <div className="text-gray-400">Gas</div>
                <div className="font-medium">${selectedDest.estimatedCosts.fuel}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Hotels</div>
                <div className="font-medium">${selectedDest.estimatedCosts.accommodation}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Food</div>
                <div className="font-medium">${selectedDest.estimatedCosts.food}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400">Total</div>
                <div className="font-bold text-purple-600">${selectedDest.estimatedCosts.total}</div>
              </div>
            </div>

            {selectedDest.isOverBudget && (
              <div className="mt-3 pt-3 border-t border-orange-100 flex items-center gap-1.5 text-xs text-orange-600 font-medium">
                <DollarSign className="h-3.5 w-3.5" />
                ~${Math.abs(selectedDest.estimatedCosts.remaining)} over budget — but it might be worth it
              </div>
            )}
          </div>

          <button
            onClick={() => onSelectDestination(selectedDest)}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-base"
          >
            Build this trip in Plan Mode →
          </button>
        </div>
      </div>
    );
  }

  // ── Destination list ──────────────────────────────────────────────────────
  if (destinations.length > 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            {destinations.length} destinations within your budget
          </p>

          {destinations.map((dest) => (
            <button
              key={dest.id}
              onClick={() => setSelectedDest(dest)}
              className="w-full text-left p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="flex gap-4">
                {dest.imageUrl && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={dest.imageUrl} alt={dest.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <span>{CATEGORY_EMOJI[dest.category]}</span>
                        {dest.name}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{dest.description}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {dest.isOverBudget && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                          tight budget
                        </span>
                      )}
                      <div className={cn(
                        'px-2 py-1 rounded-full text-xs font-bold',
                        dest.score >= 80
                          ? 'bg-green-100 text-green-700'
                          : dest.score >= 60
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      )}>
                        {dest.score}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {dest.distanceKm} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dest.estimatedDriveHours}h drive
                    </span>
                    {dest.isOverBudget ? (
                      <span className="flex items-center gap-1 text-orange-600 font-medium">
                        <DollarSign className="h-3 w-3" />
                        ~${Math.abs(dest.estimatedCosts.remaining)} over budget
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <DollarSign className="h-3 w-3" />
                        ${dest.estimatedCosts.remaining} left to spend
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {dest.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center text-gray-300 group-hover:text-purple-500 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-gray-400">Gas</div>
                  <div className="font-medium">${dest.estimatedCosts.fuel}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Hotels</div>
                  <div className="font-medium">${dest.estimatedCosts.accommodation}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Food</div>
                  <div className="font-medium">${dest.estimatedCosts.food}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Total</div>
                  <div className="font-bold text-purple-600">${dest.estimatedCosts.total}</div>
                </div>
              </div>
            </button>
          ))}
          {challengesSection}
        </div>
      </div>
    );
  }

  if (hasSearched) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">😢</div>
          <p className="text-gray-600 font-medium">No destinations found in budget</p>
          <p className="text-sm text-gray-400 mt-1">
            Try increasing your budget or days
            {isRoundTrip && ', or switch to one-way'}
          </p>
        </div>
        {challengesSection}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Compass className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Enter your starting location to begin</p>
      </div>
      {challengesSection}
    </div>
  );
}

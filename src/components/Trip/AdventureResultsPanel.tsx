import { Sparkles, MapPin, Clock, DollarSign, ChevronRight, Compass } from 'lucide-react';
import type { AdventureDestination } from '../../types';
import { cn } from '../../lib/utils';

interface AdventureResultsPanelProps {
  isCalculating: boolean;
  destinations: AdventureDestination[];
  hasSearched: boolean;
  isRoundTrip: boolean;
  onSelectDestination: (dest: AdventureDestination) => void;
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
  onSelectDestination,
}: AdventureResultsPanelProps) {
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
              onClick={() => onSelectDestination(dest)}
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

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {dest.distanceKm} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dest.estimatedDriveHours}h drive
                    </span>
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <DollarSign className="h-3 w-3" />
                      ${dest.estimatedCosts.remaining} left to spend
                    </span>
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
        </div>
      </div>
    );
  }

  if (hasSearched) {
    return (
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-4xl mb-3">😢</div>
          <p className="text-gray-600 font-medium">No destinations found in budget</p>
          <p className="text-sm text-gray-400 mt-1">
            Try increasing your budget or days
            {isRoundTrip && ', or switch to one-way'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center py-12">
      <div className="text-center">
        <Compass className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Enter your starting location to begin</p>
      </div>
    </div>
  );
}

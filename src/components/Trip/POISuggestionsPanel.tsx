import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import type { POISuggestion } from '../../types';
import { POISuggestionCard } from './POISuggestionCard';
import { cn } from '../../lib/utils';

interface POISuggestionsPanelProps {
  suggestions: POISuggestion[];
  isLoading: boolean;
  onAdd: (poiId: string) => void;
  onDismiss: (poiId: string) => void;
  className?: string;
}

export function POISuggestionsPanel({
  suggestions,
  isLoading,
  onAdd,
  onDismiss,
  className,
}: POISuggestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Separate by bucket
  const alongWay = suggestions.filter(s => s.bucket === 'along-way' && s.actionState !== 'dismissed');
  const atDestination = suggestions.filter(s => s.bucket === 'destination' && s.actionState !== 'dismissed');

  const visibleCount = alongWay.length + atDestination.length;

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border-2 border-purple-200 bg-purple-50/50 p-4', className)}>
        <div className="flex items-center justify-center gap-2 text-purple-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Finding awesome stops along your route...</span>
        </div>
      </div>
    );
  }

  if (visibleCount === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-xl border-2 border-purple-200 bg-purple-50/50', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-purple-100/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="font-bold text-purple-900">
            Suggested Stops & Activities
          </h3>
          <span className="text-xs font-semibold text-purple-700 bg-purple-200 px-2 py-0.5 rounded-full">
            {visibleCount} {visibleCount === 1 ? 'suggestion' : 'suggestions'}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-purple-600" />
        ) : (
          <ChevronDown className="h-5 w-5 text-purple-600" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-4">
          <p className="text-xs text-purple-700 mb-3">
            ✨ We found some great places based on your trip preferences. Tap ✓ to add them to your itinerary.
          </p>

          {/* Along the Way Section */}
          {alongWay.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
                🛣️ Along Your Route
                <span className="text-xs font-normal text-purple-600">
                  ({alongWay.length})
                </span>
              </h4>
              <div className="space-y-3">
                {alongWay.map(poi => (
                  <POISuggestionCard
                    key={poi.id}
                    poi={poi}
                    onAdd={onAdd}
                    onDismiss={onDismiss}
                  />
                ))}
              </div>
            </div>
          )}

          {/* At Destination Section */}
          {atDestination.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-1.5 mt-4">
                🎯 At Your Destination
                <span className="text-xs font-normal text-purple-600">
                  ({atDestination.length})
                </span>
              </h4>
              <div className="space-y-3">
                {atDestination.map(poi => (
                  <POISuggestionCard
                    key={poi.id}
                    poi={poi}
                    onAdd={onAdd}
                    onDismiss={onDismiss}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

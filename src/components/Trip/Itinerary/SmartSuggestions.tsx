import { Lightbulb, Users, Coffee, Clock } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface SmartSuggestionsProps {
  suggestions: string[];
}

export function SmartSuggestions({ suggestions }: SmartSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-semibold">Smart Pacing Suggestions</h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion, idx) => {
          // Determine icon + left-border accent by suggestion category
          const isDriver = suggestion.includes('driver') || suggestion.includes('swap');
          const isRest = suggestion.includes('break') || suggestion.includes('stretch');
          const isTiming = suggestion.includes('departing') || suggestion.includes('starting');

          const icon = isDriver
            ? <Users className="h-4 w-4 text-blue-400" />
            : isRest
            ? <Coffee className="h-4 w-4 text-amber-400" />
            : isTiming
            ? <Clock className="h-4 w-4 text-purple-400" />
            : <Lightbulb className="h-4 w-4 text-yellow-400" />;

          const accentBorder = isDriver
            ? 'border-l-2 border-l-blue-500'
            : isRest
            ? 'border-l-2 border-l-amber-500'
            : isTiming
            ? 'border-l-2 border-l-purple-500'
            : 'border-l-2 border-l-yellow-500';

          return (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border border-white/10 text-sm",
                "bg-gradient-to-r from-primary/5 to-transparent hover:shadow-sm transition-shadow",
                accentBorder,
              )}
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-1">{suggestion}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

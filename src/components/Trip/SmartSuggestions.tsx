import { Lightbulb, Users, Coffee, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

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
          // Determine icon based on suggestion content
          const icon = suggestion.includes('driver') || suggestion.includes('swap')
            ? <Users className="h-4 w-4 text-blue-500" />
            : suggestion.includes('break') || suggestion.includes('stretch')
            ? <Coffee className="h-4 w-4 text-amber-500" />
            : suggestion.includes('departing') || suggestion.includes('starting')
            ? <Clock className="h-4 w-4 text-purple-500" />
            : <Lightbulb className="h-4 w-4 text-yellow-500" />;

          return (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border text-sm",
                "bg-gradient-to-r from-primary/5 to-transparent hover:shadow-sm transition-shadow"
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

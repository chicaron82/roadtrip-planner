import { Mountain, Zap, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RoutePreference } from '../../types';

interface RoutePreferenceCardsProps {
  value: RoutePreference;
  onChange: (value: RoutePreference) => void;
}

const ROUTE_OPTIONS: {
  value: RoutePreference;
  label: string;
  icon: typeof Mountain;
  description: string;
  color: string;
}[] = [
  {
    value: 'fastest',
    label: '🚗 Fastest',
    icon: Zap,
    description: 'Highways & major routes',
    color: 'blue',
  },
  {
    value: 'scenic',
    label: '🏔️ Scenic',
    icon: Mountain,
    description: 'Backroads & scenic views',
    color: 'green',
  },
  {
    value: 'economical',
    label: '💰 Cheapest',
    icon: DollarSign,
    description: 'Avoid tolls & minimize cost',
    color: 'yellow',
  },
];

export function RoutePreferenceCards({ value, onChange }: RoutePreferenceCardsProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Route Preference
      </label>
      <div className="grid grid-cols-3 gap-2">
        {ROUTE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative p-3 rounded-lg border-2 transition-all text-left group",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-muted hover:border-primary/50 hover:shadow-sm bg-background"
              )}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    isSelected
                      ? option.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        option.color === 'green' ? 'bg-green-100 text-green-600' :
                        'bg-yellow-100 text-yellow-600'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{option.label.split(' ')[1]}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {option.description}
                  </div>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { Check, X, Clock, Fuel, Coffee, UtensilsCrossed, Hotel } from 'lucide-react';
import type { SuggestedStop } from '../../lib/stop-suggestions';
import { getStopColors } from '../../lib/stop-suggestions';
import { Button } from '../UI/Button';
import { cn } from '../../lib/utils';

interface SuggestedStopCardProps {
  stop: SuggestedStop;
  onAccept: (stopId: string) => void;
  onDismiss: (stopId: string) => void;
}

const StopIcon = ({ type }: { type: SuggestedStop['type'] }) => {
  const iconClass = "h-5 w-5";
  switch (type) {
    case 'fuel': return <Fuel className={iconClass} />;
    case 'rest': return <Coffee className={iconClass} />;
    case 'meal': return <UtensilsCrossed className={iconClass} />;
    case 'overnight': return <Hotel className={iconClass} />;
    default: return <Coffee className={iconClass} />;
  }
};

const StopTitle = ({ type }: { type: SuggestedStop['type'] }) => {
  switch (type) {
    case 'fuel': return 'Fuel Stop';
    case 'rest': return 'Rest Break';
    case 'meal': return 'Meal Stop';
    case 'overnight': return 'Overnight Stay';
    default: return 'Suggested Stop';
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function SuggestedStopCard({ stop, onAccept, onDismiss }: SuggestedStopCardProps) {
  const colors = getStopColors(stop.type);

  if (stop.dismissed) return null;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed p-4 transition-all duration-300",
        "animate-in fade-in slide-in-from-left-4",
        colors.bg,
        colors.border,
        stop.accepted && "border-solid opacity-90"
      )}
    >
      {/* Priority Badge */}
      {stop.priority === 'required' && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          REQUIRED
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            colors.bg,
            colors.text,
            "border-2 border-current"
          )}
        >
          <StopIcon type={stop.type} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("font-bold text-sm", colors.text)}>
              <StopTitle type={stop.type} />
            </span>
            {stop.accepted && (
              <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">
                ADDED
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {stop.reason}
          </p>

          {/* Details */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatTime(stop.estimatedTime)}</span>
              <span className="text-slate-300">•</span>
              <span>{stop.duration} min</span>
            </div>

            {stop.details.fuelCost && (
              <div className={cn("font-medium", colors.text)}>
                ~${stop.details.fuelCost.toFixed(2)} ({stop.details.fuelNeeded?.toFixed(0)}L)
              </div>
            )}

            {stop.details.hoursOnRoad && (
              <div className="text-muted-foreground">
                {stop.details.hoursOnRoad.toFixed(1)}h on road
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!stop.accepted && (
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-green-100 hover:text-green-600"
              onClick={() => onAccept(stop.id)}
              title="Add this stop"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
              onClick={() => onDismiss(stop.id)}
              title="Dismiss suggestion"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

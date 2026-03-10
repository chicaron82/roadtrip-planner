import { Clock, MapPin } from 'lucide-react';
import { formatTimeInZone } from '../../../lib/trip-timezone';

interface StartNodeProps {
  locationName: string;
  startTime: Date;
  timezone?: string;
  isCalculatedDeparture?: boolean;
}

const formatTime = (date: Date, ianaTimezone?: string) => formatTimeInZone(date, ianaTimezone);

const formatDate = (date: Date) =>
  date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export function StartNode({ locationName, startTime, timezone, isCalculatedDeparture }: StartNodeProps) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center border-2 border-green-200 shadow-sm z-10">
          <MapPin className="h-5 w-5" />
        </div>
      </div>
      <div className="pt-1">
        <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-0.5">Start</div>
        <div className="font-bold text-xl">{locationName}</div>
        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          <Clock className="h-3 w-3" /> {formatDate(startTime)} • {formatTime(startTime, timezone)}
          {isCalculatedDeparture && (
            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">CALCULATED</span>
          )}
        </div>
      </div>
    </div>
  );
}
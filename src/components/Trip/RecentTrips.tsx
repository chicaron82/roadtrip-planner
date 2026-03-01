import type { TripSummary } from '../../types';

interface Props {
  history: TripSummary[];
  onLoadHistoryTrip?: (trip: TripSummary) => void;
}

export function RecentTrips({ history, onLoadHistoryTrip }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-sm font-semibold mb-2">Recent Trips</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {history.slice(0, 5).map((trip, i) => {
          const origin = trip.segments[0]?.from.name ?? 'Unknown';
          const dest = trip.segments[trip.segments.length - 1]?.to.name ?? 'Unknown';
          const date = trip.displayDate
            ? new Date(trip.displayDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
            : null;
          const clickable = !!onLoadHistoryTrip;
          return (
            <div
              key={i}
              onClick={() => onLoadHistoryTrip?.(trip)}
              className="p-2 border rounded text-xs bg-muted/20"
              style={{
                cursor: clickable ? 'pointer' : 'default',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={e => {
                if (clickable) {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(245,158,11,0.08)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(245,158,11,0.4)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = '';
                (e.currentTarget as HTMLDivElement).style.borderColor = '';
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-foreground truncate mr-2">
                  {origin} → {dest}
                </span>
                {date && <span className="text-muted-foreground shrink-0">{date}</span>}
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{trip.totalDistanceKm.toFixed(0)} km</span>
                <span className="text-green-600">${trip.totalFuelCost.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TripSummary, TripSettings } from '../../types';
import { cn } from '../../lib/utils';
import { TRIP_CONSTANTS } from '../../lib/trip-constants';

interface HoursTradeoffProps {
  summary: TripSummary;
  settings: TripSettings;
  className?: string;
}

const CANDIDATE_HOURS = [8, 9, 10, 12, 14, 16];
const LATE_ARRIVAL_HOUR = 22; // 10 PM

function estimateDrivingDays(totalMinutes: number, maxHours: number): number {
  // Mirror the same tolerance the day-splitter uses so estimates are consistent.
  const effectiveMax = (maxHours + TRIP_CONSTANTS.dayOverflow.toleranceHours) * 60;
  return Math.ceil(totalMinutes / effectiveMax);
}

function formatArrival(decimal: number): { label: string; late: boolean } {
  const nextDay = decimal >= 24;
  const norm = nextDay ? decimal - 24 : decimal;
  const h24 = Math.floor(norm);
  const m = Math.round((norm - h24) * 60);
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const minStr = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
  return {
    label: `~${h12}${minStr} ${period}${nextDay ? ' +1d' : ''}`,
    late: decimal >= LATE_ARRIVAL_HOUR,
  };
}

export function HoursTradeoff({ summary, settings, className }: HoursTradeoffProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!settings.isRoundTrip || !settings.returnDate || !summary.days) return null;
  if (settings.numDrivers < 2) return null;

  const dep = new Date(settings.departureDate + 'T00:00:00');
  const ret = new Date(settings.returnDate + 'T00:00:00');
  const totalCalendarDays = Math.max(
    1,
    Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  const [depH, depM] = settings.departureTime.split(':').map(Number);
  const departureDecimal = depH + (depM || 0) / 60;

  // Round trips: totalDurationMinutes includes both legs — halve to get one-way.
  const outboundMinutes = summary.totalDurationMinutes / 2;

  const rows = CANDIDATE_HOURS.flatMap(h => {
    const outboundDays = estimateDrivingDays(outboundMinutes, h);
    const totalTransit = outboundDays * 2; // symmetric round trip
    const freeDays = totalCalendarDays - totalTransit;
    if (freeDays < 0) return [];
    const dailyDriveHours = (outboundMinutes / 60) / outboundDays;
    const arrivalDecimal = departureDecimal + Math.min(h, dailyDriveHours);
    return [{ h, totalTransit, freeDays, arrival: formatArrival(arrivalDecimal), isCurrent: h === settings.maxDriveHours }];
  });

  if (rows.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-muted/30', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Hours Tradeoff
        </span>
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>

      {isOpen && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-1.5 font-medium">Hours/day</th>
                <th className="text-right pb-1.5 font-medium">Drive</th>
                <th className="text-right pb-1.5 font-medium">Free</th>
                <th className="text-right pb-1.5 font-medium">Arrives Day 1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map(r => (
                <tr
                  key={r.h}
                  className={cn(
                    'transition-colors',
                    r.isCurrent
                      ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <td className="py-1.5 text-foreground">
                    {r.h}h/day
                    {r.isCurrent && (
                      <span className="ml-1.5 text-[9px] text-blue-500 uppercase tracking-wide">current</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">{r.totalTransit}d</td>
                  <td className={cn(
                    'py-1.5 text-right font-medium',
                    r.freeDays === 0 ? 'text-red-500' : r.freeDays <= 1 ? 'text-amber-500' : 'text-green-600',
                  )}>
                    {r.freeDays}d
                  </td>
                  <td className={cn('py-1.5 text-right', r.arrival.late ? 'text-amber-600' : 'text-muted-foreground')}>
                    {r.arrival.label}{r.arrival.late && ' ⚠️'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-muted-foreground/60 leading-tight">
            Estimated — assumes symmetric return route and same departure time each day.
          </p>
        </div>
      )}
    </div>
  );
}

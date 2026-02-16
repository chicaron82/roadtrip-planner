import { useState } from 'react';
import { Calendar, Clock, MapPin, Route, Edit3 } from 'lucide-react';
import type { TripDay, DayType } from '../../types';
import { cn } from '../../lib/utils';
import { DayTypeToggle, DayTypeBadge } from './FlexibleDay';
import { Input } from '../UI/Input';

interface DayHeaderProps {
  day: TripDay;
  isFirst?: boolean;
  className?: string;
  editable?: boolean;
  onDayTypeChange?: (dayNumber: number, type: DayType) => void;
  onTitleChange?: (dayNumber: number, title: string) => void;
  onEditOvernight?: (dayNumber: number) => void;
}

export function DayHeader({
  day,
  isFirst = false,
  className,
  editable = false,
  onDayTypeChange,
  onTitleChange,
  onEditOvernight,
}: DayHeaderProps) {
  const dayType = day.dayType || 'planned';
  const [editingTitle, setEditingTitle] = useState(false);
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div
      className={cn(
        "relative",
        !isFirst && "mt-8 pt-8 border-t-2 border-dashed border-indigo-200",
        className
      )}
    >
      {/* Day Badge */}
      <div className="flex items-start gap-4 mb-6">
        {/* Day Number Circle */}
        <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center text-white shadow-lg">
          <span className="text-[10px] uppercase tracking-wider font-medium opacity-80">Day</span>
          <span className="text-2xl font-bold leading-none">{day.dayNumber}</span>
        </div>

        {/* Day Info */}
        <div className="flex-1 min-w-0 pt-1">
          {/* Date & Day Type */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{day.dateFormatted}</span>
            {dayType !== 'planned' && <DayTypeBadge dayType={dayType} />}
          </div>

          {/* Day Type Toggle (when editable) */}
          {editable && onDayTypeChange && (
            <DayTypeToggle
              dayType={dayType}
              onChange={(type) => onDayTypeChange(day.dayNumber, type)}
              className="mb-2 max-w-xs"
            />
          )}

          {/* Title & Route */}
          {editable && onTitleChange && editingTitle ? (
            <Input
              value={day.title || ''}
              onChange={(e) => onTitleChange(day.dayNumber, e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
              placeholder="Day title..."
              className="text-lg font-bold mb-0.5 max-w-xs"
              autoFocus
            />
          ) : day.title ? (
            <h3
              className={cn(
                "text-lg font-bold text-gray-900 mb-0.5",
                editable && onTitleChange && "cursor-pointer hover:text-indigo-600 inline-flex items-center gap-1 group"
              )}
              onClick={() => editable && onTitleChange && setEditingTitle(true)}
            >
              {day.title}
              {editable && onTitleChange && (
                <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              )}
            </h3>
          ) : editable && onTitleChange ? (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="text-sm text-gray-400 hover:text-indigo-600 mb-0.5 flex items-center gap-1"
            >
              <Edit3 className="h-3 w-3" />
              Add title
            </button>
          ) : null}
          <div className="flex items-center gap-1.5 text-gray-700">
            <Route className="h-4 w-4 text-indigo-500" />
            <span className="font-medium">{day.route}</span>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{Math.round(day.totals.distanceKm)} km</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(day.totals.driveTimeMinutes)} drive</span>
            </div>
            {day.totals.departureTime && (
              <div className="flex items-center gap-1 text-green-600 font-medium">
                <span>Depart {formatTime(day.totals.departureTime)}</span>
              </div>
            )}
            {day.totals.arrivalTime && (
              <div className="flex items-center gap-1 text-blue-600 font-medium">
                <span>Arrive {formatTime(day.totals.arrivalTime)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timezone Changes Alert */}
      {day.timezoneChanges.length > 0 && (
        <div className="mb-4 space-y-2">
          {day.timezoneChanges.map((tz, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800"
            >
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                TIME ZONE CHANGE: {tz.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Overnight Stop Info */}
      {day.overnight && (
        <div
          className={cn(
            "mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200",
            onEditOvernight && "cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
          )}
          onClick={() => onEditOvernight?.(day.dayNumber)}
          role={onEditOvernight ? 'button' : undefined}
          tabIndex={onEditOvernight ? 0 : undefined}
          onKeyDown={(e) => e.key === 'Enter' && onEditOvernight?.(day.dayNumber)}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🏨</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
                {day.overnight.hotelName || 'Overnight Stay'}
                {onEditOvernight && !day.overnight.hotelName && (
                  <span className="text-[10px] text-indigo-400 font-normal">click to add details</span>
                )}
              </div>
              {day.overnight.address && (
                <div className="text-xs text-indigo-600 truncate">
                  {day.overnight.address}
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-indigo-700">
                <span className="font-medium">${day.overnight.cost}</span>
                <span>•</span>
                <span>{day.overnight.roomsNeeded} room{day.overnight.roomsNeeded > 1 ? 's' : ''}</span>
                {day.overnight.amenities && day.overnight.amenities.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{day.overnight.amenities.join(', ')}</span>
                  </>
                )}
                {day.overnight.checkIn && (
                  <>
                    <span>•</span>
                    <span>Check-in: {day.overnight.checkIn}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

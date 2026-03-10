import { useState } from 'react';
import { Coffee } from 'lucide-react';
import type { TripDay } from '../../../types';
import { cn } from '../../../lib/utils';
import { Input } from '../../UI/Input';

interface FreeDayCardProps {
  day: TripDay;
  onNotesChange: (notes: string) => void;
  onTitleChange: (title: string) => void;
  className?: string;
}

export function FreeDayCard({ day, onNotesChange, onTitleChange, className }: FreeDayCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white p-6 text-center',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <Coffee className="h-8 w-8 text-gray-400" />
        </div>

        <div>
          {isEditing ? (
            <Input
              value={day.title || ''}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              placeholder="Day title..."
              className="text-center font-semibold"
              autoFocus
            />
          ) : (
            <h3
              className="text-lg font-semibold text-gray-700 cursor-pointer hover:text-gray-900"
              onClick={() => setIsEditing(true)}
            >
              {day.title || 'Free Day'}
            </h3>
          )}
          <p className="text-sm text-gray-500">{day.dateFormatted}</p>
        </div>

        <p className="text-sm text-gray-600 italic">No fixed plans - enjoy the flexibility!</p>

        <textarea
          value={day.notes || ''}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add notes... (weather-dependent plans, maybe-dos, etc.)"
          rows={3}
          className="w-full max-w-sm px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />

        <div className="flex gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded-full">💰 $0 budgeted</span>
          <span className="px-2 py-1 bg-gray-100 rounded-full">🚗 0 km</span>
        </div>
      </div>
    </div>
  );
}
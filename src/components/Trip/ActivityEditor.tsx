import { useState } from 'react';
import { Clock, MapPin, DollarSign, FileText, Link, Star, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/Dialog';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import type { Activity, ActivityCategory } from '../../types';
import { cn } from '../../lib/utils';

const ACTIVITY_CATEGORIES: { value: ActivityCategory; label: string; emoji: string }[] = [
  { value: 'photo', label: 'Photo Op', emoji: '📸' },
  { value: 'meal', label: 'Meal', emoji: '🍽️' },
  { value: 'attraction', label: 'Attraction', emoji: '🏛️' },
  { value: 'museum', label: 'Museum', emoji: '🖼️' },
  { value: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { value: 'nature', label: 'Nature', emoji: '🌲' },
  { value: 'rest', label: 'Rest Stop', emoji: '☕' },
  { value: 'fuel', label: 'Gas Station', emoji: '⛽' },
  { value: 'other', label: 'Other', emoji: '📌' },
];

interface ActivityEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: Activity;
  locationName?: string;
  onSave: (activity: Activity) => void;
  onRemove?: () => void;
}

export function ActivityEditor({
  open,
  onOpenChange,
  activity,
  locationName,
  onSave,
  onRemove,
}: ActivityEditorProps) {
  const [name, setName] = useState(activity?.name || locationName || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [category, setCategory] = useState<ActivityCategory>(activity?.category || 'other');
  const [startTime, setStartTime] = useState(activity?.plannedStartTime || '');
  const [endTime, setEndTime] = useState(activity?.plannedEndTime || '');
  const [cost, setCost] = useState(activity?.cost?.toString() || '');
  const [notes, setNotes] = useState(activity?.notes || '');
  const [url, setUrl] = useState(activity?.url || '');
  const [isRequired, setIsRequired] = useState(activity?.isRequired || false);

  const handleSave = () => {
    if (!name.trim()) return;

    const durationMinutes = startTime && endTime
      ? calculateDuration(startTime, endTime)
      : undefined;

    const newActivity: Activity = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      plannedStartTime: startTime || undefined,
      plannedEndTime: endTime || undefined,
      durationMinutes,
      cost: cost ? parseFloat(cost) : undefined,
      notes: notes.trim() || undefined,
      url: url.trim() || undefined,
      isRequired,
    };

    onSave(newActivity);
    onOpenChange(false);
  };

  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const duration = startTime && endTime ? calculateDuration(startTime, endTime) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            {activity ? 'Edit Activity' : 'Add Activity'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Activity Name */}
          <div>
            <Label className="text-sm font-medium">Activity Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Visit Covent Garden Market"
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Category Grid */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    'p-2 rounded-lg text-xs font-medium transition-all text-center',
                    category === cat.value
                      ? 'bg-blue-100 border-2 border-blue-500 text-blue-700'
                      : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <div className="text-lg mb-0.5">{cat.emoji}</div>
                  <div className="text-[10px]">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Window */}
          <div>
            <Label className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              Time Window (optional)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1"
              />
              <span className="text-gray-400">→</span>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1"
              />
            </div>
            {duration !== null && duration > 0 && (
              <p className="text-xs text-green-600 mt-1">
                Duration: {formatDuration(duration)}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-gray-500" />
              Description (optional)
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this stop special?"
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Cost & URL row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-green-500" />
                Cost
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <Input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Link className="h-4 w-4 text-blue-500" />
                Website
              </Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cash only, Closed Mondays, etc."
              className="mt-1"
            />
          </div>

          {/* Required toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-800">Must-Do Activity</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onRemove && activity && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onOpenChange(false);
                }}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Remove
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                name.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              {activity ? 'Save Changes' : 'Add Activity'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact inline display for activity in timeline
interface ActivityBadgeProps {
  activity: Activity;
  onClick?: () => void;
  className?: string;
}

export function ActivityBadge({ activity, onClick, className }: ActivityBadgeProps) {
  const cat = ACTIVITY_CATEGORIES.find(c => c.value === activity.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
        'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100',
        activity.isRequired && 'ring-2 ring-amber-300',
        className
      )}
    >
      <span>{cat?.emoji || '📌'}</span>
      <span className="max-w-[120px] truncate">{activity.name}</span>
      {activity.plannedStartTime && (
        <span className="text-blue-500">
          {activity.plannedStartTime}
          {activity.plannedEndTime && `–${activity.plannedEndTime}`}
        </span>
      )}
    </button>
  );
}

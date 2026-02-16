import { useState, useRef } from 'react';
import {
  Camera,
  PenLine,
  Check,
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import type { JournalEntry, JournalPhoto, RouteSegment } from '../../types';
import { Button } from '../UI/Button';
import { cn } from '../../lib/utils';

interface JournalStopCardProps {
  segment: RouteSegment;
  segmentIndex: number;
  entry?: JournalEntry;
  onUpdateEntry: (entry: Partial<JournalEntry>) => void;
  onAddPhoto: (photo: JournalPhoto) => void;
  onRemovePhoto: (photoId: string) => void;
  className?: string;
}

export function JournalStopCard({
  segment,
  segmentIndex,
  entry,
  onUpdateEntry,
  onAddPhoto,
  onRemovePhoto,
  className,
}: JournalStopCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(entry?.notes || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasArrived = entry?.status === 'visited';
  const isHighlight = entry?.isHighlight || false;

  // Format time
  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '--:--';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleArrive = () => {
    onUpdateEntry({
      status: 'visited',
      actualArrival: new Date(),
    });
  };

  const handleToggleHighlight = () => {
    onUpdateEntry({
      isHighlight: !isHighlight,
    });
  };

  const handleSaveNotes = () => {
    onUpdateEntry({ notes: notesValue });
    setIsEditingNotes(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Import compression function dynamically to keep bundle smaller
    const { createPhotoFromFile } = await import('../../lib/journal-storage');
    const photo = await createPhotoFromFile(file);
    onAddPhoto(photo);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const stopName = segment.to.name.split(',')[0];
  const plannedArrival = segment.arrivalTime ? new Date(segment.arrivalTime) : null;

  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-all duration-300',
        hasArrived
          ? 'bg-gradient-to-br from-green-50 to-white border-green-200'
          : 'bg-white border-gray-200',
        className
      )}
    >
      {/* Header Row */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-lg',
              hasArrived ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
            )}
          >
            {hasArrived ? <Check className="h-5 w-5" /> : segmentIndex + 1}
          </div>

          <div>
            <h4 className="font-semibold text-sm">{stopName}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Plan: {formatTime(plannedArrival ?? undefined)}</span>
              {hasArrived && entry?.actualArrival && (
                <>
                  <span className="text-green-600">|</span>
                  <span className="text-green-600 font-medium">
                    Actual: {formatTime(entry.actualArrival)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Highlight Star */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 w-8 p-0',
              isHighlight ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
            )}
            onClick={handleToggleHighlight}
            title={isHighlight ? 'Remove highlight' : 'Mark as highlight'}
          >
            <Star className={cn('h-4 w-4', isHighlight && 'fill-current')} />
          </Button>

          {/* Arrive Button (only if not arrived) */}
          {!hasArrived && (
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white gap-1"
              onClick={handleArrive}
            >
              <Check className="h-4 w-4" />
              Arrived
            </Button>
          )}

          {/* Expand Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Add Photo
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={() => setIsEditingNotes(true)}
            >
              <PenLine className="h-4 w-4" />
              {entry?.notes ? 'Edit Notes' : 'Add Notes'}
            </Button>
          </div>

          {/* Photos Grid */}
          {entry?.photos && entry.photos.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Photos ({entry.photos.length})
              </h5>
              <div className="grid grid-cols-3 gap-2">
                {entry.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.dataUrl}
                      alt={photo.caption || 'Trip photo'}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => onRemovePhoto(photo.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {photo.caption && (
                      <p className="text-xs text-gray-600 mt-1 truncate">{photo.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Write about your experience here..."
                className="w-full h-24 p-3 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotesValue(entry?.notes || '');
                    setIsEditingNotes(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveNotes}>
                  Save Notes
                </Button>
              </div>
            </div>
          ) : entry?.notes ? (
            <div
              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setIsEditingNotes(true)}
            >
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          ) : null}

          {/* Highlight Reason */}
          {isHighlight && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0 mt-0.5" />
              <input
                type="text"
                value={entry?.highlightReason || ''}
                onChange={(e) => onUpdateEntry({ highlightReason: e.target.value })}
                placeholder="Why was this stop special?"
                className="flex-1 bg-transparent text-sm text-yellow-800 placeholder-yellow-600 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Collapsed Preview */}
      {!isExpanded && hasArrived && (entry?.photos?.length || entry?.notes) && (
        <div className="px-4 pb-3 flex items-center gap-3 text-xs text-muted-foreground">
          {entry?.photos && entry.photos.length > 0 && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {entry.photos.length}
            </span>
          )}
          {entry?.notes && (
            <span className="flex items-center gap-1">
              <PenLine className="h-3 w-3" />
              Note
            </span>
          )}
          {isHighlight && (
            <span className="flex items-center gap-1 text-yellow-600">
              <Star className="h-3 w-3 fill-current" />
              Highlight
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Quick Arrive Button for prominent placement
interface QuickArriveButtonProps {
  stopName: string;
  onArrive: () => void;
  className?: string;
}

export function QuickArriveButton({ stopName, onArrive, className }: QuickArriveButtonProps) {
  return (
    <button
      onClick={onArrive}
      className={cn(
        'w-full p-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white',
        'flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all',
        'active:scale-[0.98]',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        <Check className="h-6 w-6" />
      </div>
      <div className="text-left">
        <div className="text-sm font-medium opacity-90">Tap when you arrive at</div>
        <div className="text-lg font-bold">{stopName}</div>
      </div>
    </button>
  );
}

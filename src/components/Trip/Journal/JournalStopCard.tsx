import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Check,
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
  Share2,
  PenLine,
} from 'lucide-react';
import { shareStop } from '../../../lib/share-utils';
import type { JournalEntry, JournalPhoto, RouteSegment } from '../../../types';
import { formatTimeInZone, normalizeToIANA } from '../../../lib/trip-timezone';
import { Button } from '../../UI/Button';
import { cn } from '../../../lib/utils';
import { dispatchStopArrived } from '../../../hooks';
import { JournalPhotoGrid } from './JournalPhotoGrid';
import { JournalNotesEditor } from './JournalNotesEditor';

interface JournalStopCardProps {
  segment: RouteSegment;
  segmentIndex: number;
  displayIndex?: number;
  entry?: JournalEntry;
  displayTimezone?: string;
  onUpdateEntry: (entry: Partial<JournalEntry>) => void;
  onAddPhoto: (photo: JournalPhoto) => void;
  onRemovePhoto: (photoId: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function JournalStopCard({
  segment,
  segmentIndex,
  displayIndex,
  entry,
  displayTimezone,
  onUpdateEntry,
  onAddPhoto,
  onRemovePhoto,
  readOnly,
  className,
}: JournalStopCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(shareTimerRef.current), []);

  const hasArrived = entry?.status === 'visited';
  const isHighlight = entry?.isHighlight || false;

  const resolvedTimezone = displayTimezone ?? segment.timezone ?? segment.weather?.timezone ?? (segment.weather?.timezoneAbbr ? normalizeToIANA(segment.weather.timezoneAbbr) : undefined);

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '--:--';
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatTimeInZone(d, resolvedTimezone);
  };

  const handleArrive = () => {
    onUpdateEntry({
      status: 'visited',
      actualArrival: new Date(),
    });
    dispatchStopArrived({
      segmentIndex,
      toName: segment.to.name.split(',')[0],
      toLat: segment.to.lat,
      toLng: segment.to.lng,
    });
  };

  const handleToggleHighlight = () => {
    onUpdateEntry({ isHighlight: !isHighlight });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { createPhotoFromFile } = await import('../../../lib/journal-storage');
    const photo = await createPhotoFromFile(file);
    onAddPhoto(photo);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleShare = async () => {
    setShareStatus('sharing');
    const firstPhoto = entry?.photos?.[0]?.dataUrl;
    const result = await shareStop(segment.to.name.split(',')[0], entry?.notes, firstPhoto);
    if (result === 'copied') {
      setShareStatus('copied');
      shareTimerRef.current = setTimeout(() => setShareStatus('idle'), 2500);
    } else {
      setShareStatus('idle');
    }
  };

  const plannedArrival = segment.arrivalTime ? new Date(segment.arrivalTime) : null;

  const getWeatherBgClass = (tempMax?: number) => {
    if (hasArrived) return 'bg-gradient-to-br from-green-50 to-white border-green-200';
    if (tempMax === undefined) return 'bg-white border-gray-200';
    if (tempMax < 5) return 'bg-blue-50/40 border-blue-100/60 shadow-[inset_0_1px_4px_rgba(255,255,255,0.4)]';
    if (tempMax > 30) return 'bg-orange-50/30 border-orange-100/50 shadow-[inset_0_0_8px_rgba(255,237,213,0.2)]';
    return 'bg-white border-gray-200';
  };

  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-all duration-300',
        getWeatherBgClass(segment.weather?.temperatureMax),
        className
      )}
    >
      {/* Header Row */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-lg',
              hasArrived ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
            )}
          >
            {hasArrived ? <Check className="h-5 w-5" /> : (displayIndex ?? segmentIndex) + 1}
          </div>

          <div>
            <h4 className="font-semibold text-sm">{segment.to.name.split(',')[0]}</h4>
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
          {!readOnly && (
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
          )}
          {isHighlight && readOnly && (
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
          )}

          {!hasArrived && !readOnly && (
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white gap-1"
              onClick={handleArrive}
            >
              <Check className="h-4 w-4" />
              Arrived
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Quick Actions — hidden in read-only mode */}
          {!readOnly && (
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
                className={cn(
                  'flex-1 gap-2 transition-colors',
                  shareStatus === 'copied' && 'border-green-500 text-green-600'
                )}
                onClick={handleShare}
                disabled={shareStatus === 'sharing'}
              >
                <Share2 className="h-4 w-4" />
                {shareStatus === 'sharing'
                  ? 'Building…'
                  : shareStatus === 'copied'
                    ? 'Copied!'
                    : entry?.photos?.length
                      ? 'Share Story'
                      : 'Share'}
              </Button>
            </div>
          )}

          <JournalPhotoGrid photos={entry?.photos ?? []} onRemovePhoto={onRemovePhoto} readOnly={readOnly} />

          {readOnly ? (
            entry?.notes ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
            ) : null
          ) : (
            <JournalNotesEditor
              notes={entry?.notes}
              onSave={(notes) => onUpdateEntry({ notes })}
            />
          )}

          {/* Highlight Reason */}
          {isHighlight && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0 mt-0.5" />
              {readOnly ? (
                <span className="text-sm text-yellow-800">{entry?.highlightReason || 'Highlighted'}</span>
              ) : (
                <input
                  type="text"
                  value={entry?.highlightReason || ''}
                  onChange={(e) => onUpdateEntry({ highlightReason: e.target.value })}
                  placeholder="Why was this stop special?"
                  className="flex-1 bg-transparent text-sm text-yellow-800 placeholder-yellow-600 focus:outline-none"
                />
              )}
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

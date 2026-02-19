import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, Type, Tag, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/Dialog';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import type { QuickCapture, JournalPhoto } from '../../types';

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (capture: QuickCapture) => void;
  autoTaggedLocation?: string;
  autoTaggedSegment?: number;
}

const CATEGORIES = [
  { value: 'food', label: '🍔 Food', emoji: '🍔' },
  { value: 'attraction', label: '🏞️ Attraction', emoji: '🏞️' },
  { value: 'scenic', label: '📸 Scenic View', emoji: '📸' },
  { value: 'shopping', label: '🛍️ Shopping', emoji: '🛍️' },
  { value: 'other', label: '📌 Other', emoji: '📌' },
];

type GpsStatus = 'idle' | 'loading' | 'captured' | 'unavailable';

export function QuickCaptureDialog({
  open,
  onOpenChange,
  onSave,
  autoTaggedLocation,
  autoTaggedSegment,
}: QuickCaptureDialogProps) {
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('other');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-request GPS when dialog opens so it's ready by save time
  useEffect(() => {
    if (!open) {
      // Reset all state on close
      setLocationName('');
      setNotes('');
      setCategory('other');
      setPhotoPreview(null);
      setGpsCoords(null);
      setGpsStatus('idle');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('captured');
      },
      () => {
        setGpsStatus('unavailable');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [open]);

  const handleRetryGps = () => {
    if (!navigator.geolocation) return;
    setGpsStatus('loading');
    setGpsCoords(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('captured');
      },
      () => setGpsStatus('unavailable'),
      { timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!notes && !photoPreview && !locationName) {
      alert('Please add at least a photo, location, or notes!');
      return;
    }

    const resolvedName = locationName || autoTaggedLocation || '';

    const photo: JournalPhoto | undefined = photoPreview
      ? {
          id: `photo-${Date.now()}`,
          dataUrl: photoPreview,
          caption: notes || resolvedName || 'Quick capture',
          timestamp: new Date(),
          location: (resolvedName || gpsCoords)
            ? {
                lat: gpsCoords?.lat ?? 0,
                lng: gpsCoords?.lng ?? 0,
                name: resolvedName,
              }
            : undefined,
        }
      : undefined;

    const capture: QuickCapture = {
      id: `capture-${Date.now()}`,
      photo,
      autoTaggedSegment,
      autoTaggedLocation: autoTaggedLocation || locationName,
      timestamp: new Date(),
      category: category as QuickCapture['category'],
      gpsCoords: gpsCoords ?? undefined,
    };

    onSave(capture);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            Add Memory
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo Upload */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              <Camera className="h-4 w-4 inline mr-1" />
              Photo (optional)
            </Label>
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={() => setPhotoPreview(null)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Click to add photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* Location Name + GPS status */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              <MapPin className="h-4 w-4 inline mr-1" />
              Location Name
            </Label>
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder={autoTaggedLocation || 'e.g., Amazing Burger Joint'}
            />
            {/* GPS status row */}
            <div className="flex items-center gap-2 mt-1.5">
              {gpsStatus === 'loading' && (
                <>
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                  <span className="text-[11px] text-blue-600">Getting location…</span>
                </>
              )}
              {gpsStatus === 'captured' && gpsCoords && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-[11px] text-green-600">
                    GPS captured ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})
                  </span>
                </>
              )}
              {gpsStatus === 'unavailable' && (
                <>
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  <span className="text-[11px] text-amber-600">Location unavailable —</span>
                  <button
                    onClick={handleRetryGps}
                    className="text-[11px] text-amber-700 underline hover:no-underline"
                  >
                    retry
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              <Tag className="h-4 w-4 inline mr-1" />
              Category
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${
                    category === cat.value
                      ? 'bg-purple-100 border-2 border-purple-500 text-purple-700'
                      : 'bg-gray-100 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {cat.emoji}
                  <div className="text-[10px] mt-1">{cat.label.split(' ')[1]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              <Type className="h-4 w-4 inline mr-1" />
              Notes
            </Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What made this special? Any tips for others?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Save Memory
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

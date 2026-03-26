import { useState, useRef, useEffect } from 'react';
import { Camera, MapPin, Type, Tag, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../UI/Dialog';
import { Input } from '../../UI/Input';
import { Label } from '../../UI/Label';
import type { QuickCapture, JournalPhoto } from '../../../types';
import { showToast } from '../../../lib/toast';
import { findKnownHub } from '../../../lib/hub-cache';

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (capture: QuickCapture) => void;
  autoTaggedLocation?: string;
  autoTaggedSegment?: number;
  /** When set, dialog opens in edit mode pre-populated from this capture. */
  initialValues?: QuickCapture;
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
  initialValues,
}: QuickCaptureDialogProps) {
  const isEditMode = !!initialValues;
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('other');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [resolvedGpsName, setResolvedGpsName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto-request GPS when dialog opens so it's ready by save time.
  // In edit mode: pre-populate from initialValues instead of requesting GPS.
  useEffect(() => {
    if (!open) {
      // Reset all state on close (React 18+ batches these, no cascading renders)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous reset on dialog close is intentional
      setLocationName('');
      setNotes('');
      setCategory('other');
      setPhotoPreview(null);
      setGpsCoords(null);
      setGpsStatus('idle');
      setResolvedGpsName(null);
      return;
    }

    if (initialValues) {
      // Edit mode — pre-populate fields, skip GPS auto-request
      setLocationName(initialValues.autoTaggedLocation ?? '');
      setNotes(initialValues.photo?.caption ?? '');
      setCategory(initialValues.category ?? 'other');
      setPhotoPreview(initialValues.photo?.dataUrl ?? null);
      setGpsCoords(initialValues.gpsCoords ?? null);
      setGpsStatus(initialValues.gpsCoords ? 'captured' : 'idle');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        setGpsStatus('captured');
        const hubName = findKnownHub(lat, lng);
        if (hubName) setResolvedGpsName(hubName);
      },
      () => {
        setGpsStatus('unavailable');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [open, initialValues]);

  const handleRetryGps = () => {
    if (!navigator.geolocation) return;
    setGpsStatus('loading');
    setGpsCoords(null);
    setResolvedGpsName(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        setGpsStatus('captured');
        const hubName = findKnownHub(lat, lng);
        if (hubName) setResolvedGpsName(hubName);
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
      showToast({ message: 'Give us something to work with — a photo, location, or notes.', type: 'warning' });
      return;
    }

    // Prefer: user-typed > GPS-resolved city name > segment destination (only if GPS was unavailable, not just slow)
    const resolvedName = locationName || resolvedGpsName || (gpsStatus !== 'captured' ? autoTaggedLocation : '') || '';

    // In edit mode: reuse existing photo object if dataUrl unchanged (avoids new id churn)
    const photo: JournalPhoto | undefined = photoPreview
      ? photoPreview === initialValues?.photo?.dataUrl
        ? { ...initialValues.photo, caption: notes || resolvedName || 'Quick capture' }
        : {
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
      id: initialValues?.id ?? `capture-${Date.now()}`,
      photo,
      autoTaggedSegment: initialValues?.autoTaggedSegment ?? autoTaggedSegment,
      autoTaggedLocation: locationName || resolvedGpsName || (gpsStatus !== 'captured' ? autoTaggedLocation : '') || '',
      timestamp: initialValues?.timestamp ?? new Date(),
      category: category as QuickCapture['category'],
      gpsCoords: gpsCoords ?? undefined,
    };

    onSave(capture);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            {isEditMode ? 'Edit Memory' : 'Add Memory'}
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-24 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors flex flex-col items-center justify-center gap-1.5 text-purple-500"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-medium">Take Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-xs font-medium">Upload</span>
                </button>
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
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
              placeholder={resolvedGpsName || autoTaggedLocation || 'e.g., Amazing Burger Joint'}
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
                    {resolvedGpsName
                      ? `📍 ${resolvedGpsName}`
                      : `GPS captured (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)})`}
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
              {isEditMode ? 'Update Memory' : 'Save Memory'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Hotel, DollarSign, Users, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../UI/Dialog';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Button } from '../UI/Button';
import type { OvernightStop, AccommodationType } from '../../types';

// ==================== ACCOMMODATION TYPES ====================

const ACCOMMODATION_TYPES: { value: AccommodationType; emoji: string; label: string }[] = [
  { value: 'hotel', emoji: '🏨', label: 'Hotel' },
  { value: 'camping', emoji: '⛺', label: 'Camping' },
  { value: 'airbnb', emoji: '🏠', label: 'Airbnb' },
  { value: 'friends', emoji: '👥', label: 'Friends/Family' },
  { value: 'other', emoji: '📍', label: 'Other' },
];

const NAME_PLACEHOLDERS: Record<AccommodationType, string> = {
  hotel: 'e.g., Holiday Inn Express',
  camping: 'e.g., Algonquin Park Campground',
  airbnb: 'e.g., Cozy Downtown Loft',
  friends: 'e.g., Aunt Sarah\'s place',
  other: 'e.g., Hostel / Motel / Cottage',
};

const NAME_LABELS: Record<AccommodationType, string> = {
  hotel: 'Hotel Name',
  camping: 'Campsite Name',
  airbnb: 'Listing Name',
  friends: 'Host / Description',
  other: 'Name / Description',
};

// ==================== AMENITY OPTIONS ====================

const AMENITY_OPTIONS = [
  { value: 'breakfast', emoji: '🥐', label: 'Breakfast' },
  { value: 'pool', emoji: '🏊', label: 'Pool' },
  { value: 'wifi', emoji: '📶', label: 'WiFi' },
  { value: 'parking', emoji: '🅿️', label: 'Parking' },
  { value: 'gym', emoji: '💪', label: 'Gym' },
  { value: 'restaurant', emoji: '🍽️', label: 'Restaurant' },
  { value: 'laundry', emoji: '🧺', label: 'Laundry' },
  { value: 'pet-friendly', emoji: '🐕', label: 'Pets OK' },
];

// ==================== TYPES ====================

interface OvernightEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overnight: OvernightStop;
  onSave: (overnight: OvernightStop) => void;
}

// ==================== COMPONENT ====================

export function OvernightEditor({
  open,
  onOpenChange,
  overnight,
  onSave,
}: OvernightEditorProps) {
  const [accommodationType, setAccommodationType] = useState<AccommodationType>(
    overnight.accommodationType ?? 'hotel'
  );
  const [hotelName, setHotelName] = useState(overnight.hotelName || '');
  const [address, setAddress] = useState(overnight.address || '');
  const [cost, setCost] = useState(overnight.cost.toString());
  const [roomsNeeded, setRoomsNeeded] = useState(overnight.roomsNeeded);
  const [checkIn, setCheckIn] = useState(overnight.checkIn || '');
  const [checkOut, setCheckOut] = useState(overnight.checkOut || '');
  const [notes, setNotes] = useState(overnight.notes || '');
  const [amenities, setAmenities] = useState<string[]>(overnight.amenities || []);

  const toggleAmenity = (value: string) => {
    setAmenities(prev =>
      prev.includes(value)
        ? prev.filter(a => a !== value)
        : [...prev, value]
    );
  };

  const handleTypeChange = (type: AccommodationType) => {
    setAccommodationType(type);
    // Auto-zero cost for stays that are typically free
    if (type === 'friends' || type === 'other') {
      setCost('0');
    }
  };

  const handleSave = () => {
    const updated: OvernightStop = {
      ...overnight,
      accommodationType,
      hotelName: hotelName.trim() || undefined,
      address: address.trim() || undefined,
      cost: parseFloat(cost) || 0,
      roomsNeeded,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      notes: notes.trim() || undefined,
      amenities: amenities.length > 0 ? amenities : undefined,
    };
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hotel className="h-5 w-5 text-indigo-600" />
            Accommodation Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Accommodation Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {ACCOMMODATION_TYPES.map(({ value, emoji, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTypeChange(value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    accommodationType === value
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label className="text-sm font-medium">{NAME_LABELS[accommodationType]}</Label>
            <Input
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder={NAME_PLACEHOLDERS[accommodationType]}
              className="mt-1"
            />
          </div>

          {/* Address */}
          <div>
            <Label className="text-sm font-medium">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Main St, Sault Ste. Marie"
              className="mt-1"
            />
          </div>

          {/* Cost & Rooms */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Cost/Night
              </Label>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                min="0"
                step="10"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Users className="h-3 w-3" /> Rooms
              </Label>
              <Input
                type="number"
                value={roomsNeeded}
                onChange={(e) => setRoomsNeeded(parseInt(e.target.value) || 1)}
                min="1"
                max="10"
                className="mt-1"
              />
            </div>
          </div>

          {/* Check-in / Check-out */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Check-in
              </Label>
              <Input
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Check-out
              </Label>
              <Input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Amenities */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Amenities</Label>
            <div className="flex flex-wrap gap-1.5">
              {AMENITY_OPTIONS.map(({ value, emoji, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleAmenity(value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    amenities.includes(value)
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-medium">Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Confirmation #12345, ground floor preferred..."
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 bg-white"
              rows={2}
            />
          </div>

          {/* Save */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Save Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

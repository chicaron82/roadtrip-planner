import { BedDouble } from 'lucide-react';
import type { TripSettings, HotelTier } from '../../types';
import { Button } from '../UI/Button';
import { Label } from '../UI/Label';
import { HOTEL_TIERS } from '../../lib/budget';

interface AccommodationSectionProps {
  settings: TripSettings;
  setSettings: React.Dispatch<React.SetStateAction<TripSettings>>;
}

export function AccommodationSection({ settings, setSettings }: AccommodationSectionProps) {
  const activeTier: HotelTier = settings.hotelTier ?? 'regular';
  const numRooms = settings.numRooms ?? Math.ceil(settings.numTravelers / 2);
  const autoRooms = Math.ceil(settings.numTravelers / 2);
  const isAutoRooms = numRooms === autoRooms;

  const handleTierSelect = (tier: HotelTier) => {
    setSettings((prev) => ({
      ...prev,
      hotelTier: tier,
      hotelPricePerNight: HOTEL_TIERS[tier].price,
    }));
  };

  const handleRoomsChange = (delta: number) => {
    setSettings((prev) => ({
      ...prev,
      numRooms: Math.max(1, Math.min(prev.numTravelers, numRooms + delta)),
    }));
  };

  return (
    <div className="border-t pt-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <BedDouble className="h-4 w-4 text-primary" />
        Accommodation
      </h3>

      {/* Tier Picker */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {(Object.keys(HOTEL_TIERS) as HotelTier[]).map((tier) => {
          const { label, emoji, price } = HOTEL_TIERS[tier];
          const isSelected = activeTier === tier;
          return (
            <button
              key={tier}
              onClick={() => handleTierSelect(tier)}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="text-lg mb-0.5">{emoji}</div>
              <div className="text-xs font-semibold">{label}</div>
              <div className="text-[10px] text-muted-foreground">${price}/night</div>
            </button>
          );
        })}
      </div>

      {/* Selected tier description */}
      <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed">
        {HOTEL_TIERS[activeTier].description}
      </p>

      {/* Rooms Stepper */}
      <div>
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <BedDouble className="h-3 w-3" /> Rooms needed
        </Label>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 mb-1">
          {isAutoRooms ? `Auto — 1 room per 2 travellers` : 'Custom'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 transition-transform active:scale-95"
            onClick={() => handleRoomsChange(-1)}
          >
            -
          </Button>
          <div className="flex-1 text-center">
            <div className="font-bold text-2xl">{numRooms}</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 transition-transform active:scale-95"
            onClick={() => handleRoomsChange(1)}
          >
            +
          </Button>
        </div>
      </div>

      {/* Cost preview tip */}
      <p className="info-banner-blue text-xs text-muted-foreground mt-3 rounded-md p-2 border">
        💡 {numRooms} room{numRooms !== 1 ? 's' : ''} × ${HOTEL_TIERS[activeTier].price}/night — adjusted per city when we calculate your trip.
      </p>
    </div>
  );
}

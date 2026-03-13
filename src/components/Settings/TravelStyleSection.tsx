import type { HotelTier } from '../../types';
import { HOTEL_TIERS } from '../../lib/budget';

interface TravelStyleSectionProps {
  hotelTier: HotelTier;
  gasPrice: number;
  mealPricePerDay: number;
  onChange: (updates: { hotelTier?: HotelTier; gasPrice?: number; mealPricePerDay?: number }) => void;
}

const TIERS = (['budget', 'regular', 'premium'] as HotelTier[]);

export function TravelStyleSection({ hotelTier, gasPrice, mealPricePerDay, onChange }: TravelStyleSectionProps) {
  return (
    <div className="space-y-5">
      {/* Hotel tier */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Hotel Tier</p>
        <div className="flex gap-2">
          {TIERS.map((tier) => {
            const info = HOTEL_TIERS[tier];
            const active = hotelTier === tier;
            return (
              <button
                key={tier}
                onClick={() => onChange({ hotelTier: tier })}
                title={info.description}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-sky-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                <span className="text-base">{info.emoji}</span>
                <span className="font-medium">{info.label}</span>
                <span className={`text-xs ${active ? 'text-sky-100' : 'text-zinc-400'}`}>${info.price}/night</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500 mt-1 italic">{HOTEL_TIERS[hotelTier].description}</p>
      </div>

      {/* Gas price */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Gas Price (per litre)</p>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">$</span>
          <input
            type="number"
            min={0.5}
            max={5}
            step={0.05}
            value={gasPrice}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0.5 && val <= 5) onChange({ gasPrice: val });
            }}
            className="w-24 bg-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm border border-zinc-600 focus:outline-none focus:border-sky-400"
          />
          <span className="text-zinc-500 text-xs">/L</span>
        </div>
      </div>

      {/* Meal price */}
      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2">Meals (per person/day)</p>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">$</span>
          <input
            type="number"
            min={10}
            max={300}
            step={5}
            value={mealPricePerDay}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 10 && val <= 300) onChange({ mealPricePerDay: val });
            }}
            className="w-24 bg-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm border border-zinc-600 focus:outline-none focus:border-sky-400"
          />
          <span className="text-zinc-500 text-xs">/day</span>
        </div>
      </div>
    </div>
  );
}

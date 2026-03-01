import { Fuel, Hotel, Utensils, Sparkles } from 'lucide-react';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import type { TripBudget } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  budget: TripBudget;
  currencySymbol: string;
  miscLabel: string;
  onUpdateCategory: (field: 'gas' | 'hotel' | 'food' | 'misc', value: number) => void;
  onUpdateWeight: (field: 'gas' | 'hotel' | 'food' | 'misc', value: number) => void;
}

const CATEGORY_ICONS = {
  gas:   <Fuel   className="h-3.5 w-3.5 text-orange-500" />,
  hotel: <Hotel  className="h-3.5 w-3.5 text-blue-500"   />,
  food:  <Utensils className="h-3.5 w-3.5 text-green-500" />,
  misc:  <Sparkles className="h-3.5 w-3.5 text-purple-500" />,
};

const SLIDER_ICONS = {
  gas:   <Fuel   className="h-3 w-3 text-orange-500" />,
  hotel: <Hotel  className="h-3 w-3 text-blue-500"   />,
  food:  <Utensils className="h-3 w-3 text-green-500" />,
  misc:  <Sparkles className="h-3 w-3 text-purple-500" />,
};

const SLIDER_COLORS = {
  gas:   'accent-orange-500',
  hotel: 'accent-blue-500',
  food:  'accent-green-500',
  misc:  'accent-purple-500',
};

export function BudgetCategoryDetails({ budget, currencySymbol, miscLabel, onUpdateCategory, onUpdateWeight }: Props) {
  return (
    <div className="pt-3 border-t border-gray-200 space-y-4">
      {/* Category Inputs */}
      <div className="grid grid-cols-2 gap-4">
        {(['gas', 'hotel', 'food', 'misc'] as const).map((field) => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              {CATEGORY_ICONS[field]}
              {field === 'misc' ? miscLabel : field.charAt(0).toUpperCase() + field.slice(1)}
              <span className="text-gray-400 ml-auto">{budget.weights[field]}%</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                {currencySymbol}
              </span>
              <Input
                type="number"
                value={budget[field] || ''}
                onChange={(e) => onUpdateCategory(field, Number(e.target.value) || 0)}
                className="pl-7 h-9"
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Custom Weight Sliders (only in custom profile) */}
      {budget.profile === 'custom' && (
        <div className="pt-3 border-t border-gray-200 space-y-3">
          <Label className="text-xs text-gray-500">Adjust Priorities</Label>
          {(['gas', 'hotel', 'food', 'misc'] as const).map((field) => (
            <div key={field} className="flex items-center gap-3">
              <div className="w-16 flex items-center gap-1 text-xs capitalize">
                {SLIDER_ICONS[field]}
                {field}
              </div>
              <input
                type="range"
                min="0"
                max="70"
                value={budget.weights[field]}
                onChange={(e) => onUpdateWeight(field, Number(e.target.value))}
                className={cn('flex-1 h-2 rounded-lg cursor-pointer', SLIDER_COLORS[field])}
              />
              <span className="w-10 text-xs text-gray-500 text-right">
                {budget.weights[field]}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

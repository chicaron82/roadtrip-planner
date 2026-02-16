import { useState } from 'react';
import { DollarSign, Fuel, Hotel, Utensils, Sparkles, Lock, Unlock, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import type { TripBudget, Currency, BudgetProfile, BudgetWeights } from '../../types';
import { BUDGET_PROFILES, applyBudgetWeights, getPerPersonCost } from '../../lib/budget';
import { cn } from '../../lib/utils';

interface BudgetInputProps {
  budget: TripBudget;
  onChange: (budget: TripBudget) => void;
  currency: Currency;
  numTravelers?: number;
  className?: string;
}

export function BudgetInput({ budget, onChange, currency: _currency, numTravelers = 1, className }: BudgetInputProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Apply a profile's weights to the current total
  const applyProfile = (profile: BudgetProfile) => {
    const profileData = BUDGET_PROFILES[profile];
    const weights = profileData.weights;

    if (budget.allocation === 'fixed' && budget.total > 0) {
      // Fixed mode: redistribute total based on new weights
      const categories = applyBudgetWeights(budget.total, weights);
      onChange({
        ...budget,
        profile,
        weights,
        ...categories,
      });
    } else {
      // Flexible mode: just update the profile/weights
      onChange({
        ...budget,
        profile,
        weights,
      });
    }
  };

  // Toggle fixed/flexible allocation
  const toggleAllocation = () => {
    const newAllocation = budget.allocation === 'fixed' ? 'flexible' : 'fixed';

    if (newAllocation === 'fixed') {
      // Switching to fixed: recalculate total and lock it
      const total = budget.gas + budget.hotel + budget.food + budget.misc;
      onChange({
        ...budget,
        allocation: 'fixed',
        total: total > 0 ? total : 1000, // Default to $1000 if no values
      });
    } else {
      onChange({ ...budget, allocation: 'flexible' });
    }
  };

  // Update total (in fixed mode, redistributes categories)
  const updateTotal = (newTotal: number) => {
    if (budget.allocation === 'fixed') {
      const categories = applyBudgetWeights(newTotal, budget.weights);
      onChange({
        ...budget,
        ...categories,
        total: newTotal,
      });
    } else {
      // Flexible: just update total display
      onChange({ ...budget, total: newTotal });
    }
  };

  // Update individual category
  const updateCategory = (field: 'gas' | 'hotel' | 'food' | 'misc', value: number) => {
    if (budget.allocation === 'fixed') {
      // Fixed mode: adjust other categories to maintain total
      const remaining = budget.total - value;

      // Get other categories
      const others = (['gas', 'hotel', 'food', 'misc'] as const).filter(f => f !== field);
      const othersSum = others.reduce((sum, f) => sum + budget[f], 0);

      if (othersSum > 0 && remaining >= 0) {
        // Distribute the difference proportionally among others
        const newBudget = { ...budget, [field]: value };
        let distributed = 0;

        others.forEach((f) => {
          const ratio = budget[f] / othersSum;
          const newValue = Math.max(0, Math.round(remaining * ratio));
          newBudget[f] = newValue;
          distributed += newValue;
        });

        // Fix rounding errors
        const roundingDiff = remaining - distributed;
        if (roundingDiff !== 0) {
          newBudget[others[0]] += roundingDiff;
        }

        // Update weights to reflect new distribution
        newBudget.weights = {
          gas: Math.round((newBudget.gas / budget.total) * 100),
          hotel: Math.round((newBudget.hotel / budget.total) * 100),
          food: Math.round((newBudget.food / budget.total) * 100),
          misc: Math.round((newBudget.misc / budget.total) * 100),
        };
        newBudget.profile = 'custom';

        onChange(newBudget);
      }
    } else {
      // Flexible mode: just update the category and total
      const newBudget = { ...budget, [field]: value };
      newBudget.total = newBudget.gas + newBudget.hotel + newBudget.food + newBudget.misc;
      onChange(newBudget);
    }
  };

  // Update weight slider (only in custom profile)
  const updateWeight = (field: 'gas' | 'hotel' | 'food' | 'misc', value: number) => {
    // Ensure weights sum to 100
    const others = (['gas', 'hotel', 'food', 'misc'] as const).filter(f => f !== field);
    const currentOthersSum = others.reduce((sum, f) => sum + budget.weights[f], 0);
    const maxValue = budget.weights[field] + currentOthersSum;
    const newValue = Math.min(value, maxValue);

    // Scale others proportionally
    const newOthersSum = 100 - newValue;
    const scale = currentOthersSum > 0 ? newOthersSum / currentOthersSum : 0;

    const newWeights: BudgetWeights = {
      ...budget.weights,
      [field]: newValue,
    };

    others.forEach(f => {
      newWeights[f] = Math.round(budget.weights[f] * scale);
    });

    // Fix rounding
    const sum = newWeights.gas + newWeights.hotel + newWeights.food + newWeights.misc;
    if (sum !== 100) {
      newWeights[others[0]] += 100 - sum;
    }

    // Apply new weights if in fixed mode
    if (budget.allocation === 'fixed' && budget.total > 0) {
      const categories = applyBudgetWeights(budget.total, newWeights);
      onChange({
        ...budget,
        profile: 'custom',
        weights: newWeights,
        ...categories,
      });
    } else {
      onChange({
        ...budget,
        profile: 'custom',
        weights: newWeights,
      });
    }
  };

  const perPersonCost = getPerPersonCost(budget.total, numTravelers);
  const currencySymbol = '$';

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Fixed/Flexible Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <Label className="text-sm font-medium">Trip Budget</Label>
        </div>

        {/* Fixed/Flexible Toggle */}
        <button
          onClick={toggleAllocation}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
            budget.allocation === 'fixed'
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
          )}
        >
          {budget.allocation === 'fixed' ? (
            <>
              <Lock className="h-3 w-3" />
              Fixed Total
            </>
          ) : (
            <>
              <Unlock className="h-3 w-3" />
              Flexible
            </>
          )}
        </button>
      </div>

      {/* Budget Container */}
      <div className="space-y-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
        {/* Profile Cards */}
        <div>
          <Label className="text-xs text-gray-500 mb-2 block">Budget Style</Label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {(Object.keys(BUDGET_PROFILES) as BudgetProfile[]).map((profile) => {
              const { emoji, label } = BUDGET_PROFILES[profile];
              const isSelected = budget.profile === profile;
              return (
                <button
                  key={profile}
                  onClick={() => applyProfile(profile)}
                  className={cn(
                    'p-2 rounded-lg border-2 text-center transition-all',
                    isSelected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="text-lg">{emoji}</div>
                  <div className={cn(
                    'text-[10px] font-medium',
                    isSelected ? 'text-green-700' : 'text-gray-600'
                  )}>
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5 text-center">
            {BUDGET_PROFILES[budget.profile].description}
          </p>
        </div>

        {/* Total Budget Input */}
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                {budget.allocation === 'fixed' && <Lock className="h-3 w-3 text-amber-500" />}
                Total Trip Budget
              </Label>
              {budget.allocation === 'fixed' && (
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Categories adjust automatically based on style
                </p>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-green-600">
                {currencySymbol}
              </span>
              <Input
                type="number"
                value={budget.total || ''}
                onChange={(e) => updateTotal(Number(e.target.value) || 0)}
                className="pl-7 h-10 w-32 text-lg font-bold text-green-600 text-right border-green-200 focus:border-green-400 focus:ring-green-200"
                placeholder="0"
              />
            </div>
          </div>

          {/* Per Person Cost */}
          {numTravelers > 1 && budget.total > 0 && (
            <div className="flex items-center justify-end gap-1.5 mt-2 text-sm text-gray-500">
              <Users className="h-3.5 w-3.5" />
              <span>{currencySymbol}{perPersonCost} per person</span>
            </div>
          )}
        </div>

        {/* Weight Distribution Bar */}
        {budget.total > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <Label className="text-xs text-gray-500 mb-2 block">Budget Distribution</Label>
            <div className="h-4 rounded-full overflow-hidden flex bg-gray-200">
              <div
                className="bg-orange-400 transition-all"
                style={{ width: `${budget.weights.gas}%` }}
                title={`Gas: ${budget.weights.gas}%`}
              />
              <div
                className="bg-blue-400 transition-all"
                style={{ width: `${budget.weights.hotel}%` }}
                title={`Hotel: ${budget.weights.hotel}%`}
              />
              <div
                className="bg-green-400 transition-all"
                style={{ width: `${budget.weights.food}%` }}
                title={`Food: ${budget.weights.food}%`}
              />
              <div
                className="bg-purple-400 transition-all"
                style={{ width: `${budget.weights.misc}%` }}
                title={`Misc: ${budget.weights.misc}%`}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                Gas {budget.weights.gas}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Hotel {budget.weights.hotel}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Food {budget.weights.food}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Misc {budget.weights.misc}%
              </span>
            </div>
          </div>
        )}

        {/* Advanced: Category Inputs */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors pt-2"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showAdvanced ? 'Hide' : 'Show'} Category Details
        </button>

        {showAdvanced && (
          <div className="pt-3 border-t border-gray-200 space-y-4">
            {/* Category Inputs */}
            <div className="grid grid-cols-2 gap-4">
              {/* Gas Budget */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5 text-orange-500" />
                  Gas
                  <span className="text-gray-400 ml-auto">{budget.weights.gas}%</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{currencySymbol}</span>
                  <Input
                    type="number"
                    value={budget.gas || ''}
                    onChange={(e) => updateCategory('gas', Number(e.target.value) || 0)}
                    className="pl-7 h-9"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Hotel Budget */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Hotel className="h-3.5 w-3.5 text-blue-500" />
                  Hotel
                  <span className="text-gray-400 ml-auto">{budget.weights.hotel}%</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{currencySymbol}</span>
                  <Input
                    type="number"
                    value={budget.hotel || ''}
                    onChange={(e) => updateCategory('hotel', Number(e.target.value) || 0)}
                    className="pl-7 h-9"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Food Budget */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 text-green-500" />
                  Food
                  <span className="text-gray-400 ml-auto">{budget.weights.food}%</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{currencySymbol}</span>
                  <Input
                    type="number"
                    value={budget.food || ''}
                    onChange={(e) => updateCategory('food', Number(e.target.value) || 0)}
                    className="pl-7 h-9"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Misc Budget */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  Misc / Activities
                  <span className="text-gray-400 ml-auto">{budget.weights.misc}%</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{currencySymbol}</span>
                  <Input
                    type="number"
                    value={budget.misc || ''}
                    onChange={(e) => updateCategory('misc', Number(e.target.value) || 0)}
                    className="pl-7 h-9"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Custom Weight Sliders (only in custom profile) */}
            {budget.profile === 'custom' && (
              <div className="pt-3 border-t border-gray-200 space-y-3">
                <Label className="text-xs text-gray-500">Adjust Priorities</Label>
                {(['gas', 'hotel', 'food', 'misc'] as const).map((field) => {
                  const icons = {
                    gas: <Fuel className="h-3 w-3 text-orange-500" />,
                    hotel: <Hotel className="h-3 w-3 text-blue-500" />,
                    food: <Utensils className="h-3 w-3 text-green-500" />,
                    misc: <Sparkles className="h-3 w-3 text-purple-500" />,
                  };
                  const colors = {
                    gas: 'accent-orange-500',
                    hotel: 'accent-blue-500',
                    food: 'accent-green-500',
                    misc: 'accent-purple-500',
                  };
                  return (
                    <div key={field} className="flex items-center gap-3">
                      <div className="w-16 flex items-center gap-1 text-xs capitalize">
                        {icons[field]}
                        {field}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="70"
                        value={budget.weights[field]}
                        onChange={(e) => updateWeight(field, Number(e.target.value))}
                        className={cn('flex-1 h-2 rounded-lg cursor-pointer', colors[field])}
                      />
                      <span className="w-10 text-xs text-gray-500 text-right">
                        {budget.weights[field]}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

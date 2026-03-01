import { useState } from 'react';
import { DollarSign, Sparkles, Lock, Unlock, Users, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import type { TripBudget, Currency, BudgetWeights, SavedBudgetProfile } from '../../types';
import { applyBudgetWeights, getPerPersonCost } from '../../lib/budget';
import { cn } from '../../lib/utils';
import { BudgetProfilePicker, SaveProfileDialog } from './BudgetProfilePicker';
import { getAdaptiveDefaults, isAdaptiveMeaningful } from '../../lib/user-profile';
import { BudgetDistributionBar } from './BudgetDistributionBar';
import { BudgetCategoryDetails } from './BudgetCategoryDetails';

interface BudgetInputProps {
  budget: TripBudget;
  onChange: (budget: TripBudget) => void;
  currency: Currency;
  numTravelers?: number;
  className?: string;
}

export function BudgetInput({ budget, onChange, currency: _currency, numTravelers = 1, className }: BudgetInputProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeSavedProfile, setActiveSavedProfile] = useState<SavedBudgetProfile | null>(null);


  // Apply a saved profile
  const applySavedProfile = (savedProfile: SavedBudgetProfile) => {
    setActiveSavedProfile(savedProfile);

    const newBudget: TripBudget = {
      ...budget,
      profile: savedProfile.baseProfile,
      weights: savedProfile.weights,
      allocation: savedProfile.allocation,
    };

    // Apply default total if set
    if (savedProfile.defaultTotal && savedProfile.defaultTotal > 0) {
      newBudget.total = savedProfile.defaultTotal;
      if (newBudget.allocation === 'fixed') {
        const categories = applyBudgetWeights(newBudget.total, newBudget.weights);
        Object.assign(newBudget, categories);
      }
    }

    onChange(newBudget);
  };

  // Handle profile save complete
  const handleProfileSaved = (profile: SavedBudgetProfile) => {
    setActiveSavedProfile(profile);
  };

  // Check if current budget differs from active saved profile (to show save button)
  const hasUnsavedChanges = activeSavedProfile
    ? JSON.stringify(budget.weights) !== JSON.stringify(activeSavedProfile.weights)
    : budget.profile === 'custom' || budget.total > 0;

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

  const adaptiveDefaults = getAdaptiveDefaults();
  const showAdaptiveCallout = adaptiveDefaults !== null && isAdaptiveMeaningful(adaptiveDefaults);

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

      {/* Adaptive defaults callout */}
      {showAdaptiveCallout && adaptiveDefaults && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>
            Based on your past {adaptiveDefaults.tripCount} trips — Hotel ~${adaptiveDefaults.hotelPricePerNight}/night · Meals ~${adaptiveDefaults.mealPricePerDay}/day
          </span>
        </div>
      )}

      {/* Budget Container */}
      <div className="space-y-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
        {/* Profile Picker */}
        <BudgetProfilePicker
          currentBudget={budget}
          numTravelers={numTravelers}
          onSelectProfile={(newBudget) => {
            setActiveSavedProfile(null);
            onChange(newBudget);
          }}
          onSelectSavedProfile={applySavedProfile}
        />

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

          {/* Save Profile Button */}
          {hasUnsavedChanges && budget.total > 0 && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 hover:border-green-400 transition-all"
            >
              <Save className="h-4 w-4" />
              Save as Profile
            </button>
          )}
        </div>

        {/* Weight Distribution Bar */}
        <BudgetDistributionBar weights={budget.weights} total={budget.total} />

        {/* Advanced: Category Inputs */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors pt-2"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showAdvanced ? 'Hide' : 'Show'} Category Details
        </button>

        {showAdvanced && (
          <BudgetCategoryDetails
            budget={budget}
            currencySymbol={currencySymbol}
            miscLabel={activeSavedProfile?.categoryLabels?.misc || 'Misc / Activities'}
            onUpdateCategory={updateCategory}
            onUpdateWeight={updateWeight}
          />
        )}
      </div>

      {/* Save Profile Dialog */}
      <SaveProfileDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        budget={budget}
        numTravelers={numTravelers}
        onSave={handleProfileSaved}
      />
    </div>
  );
}

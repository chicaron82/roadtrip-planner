import { DollarSign, Sparkles, Lock, Unlock, Users, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Input } from '../../UI/Input';
import { Label } from '../../UI/Label';
import type { TripBudget, Currency } from '../../../types';
import { cn } from '../../../lib/utils';
import { SaveProfileDialog } from './BudgetProfilePicker';
import { BudgetDistributionBar } from './BudgetDistributionBar';
import { BudgetCategoryDetails } from './BudgetCategoryDetails';
import { useBudgetController } from '../../../hooks/useBudgetController';

interface BudgetInputProps {
  budget: TripBudget;
  onChange: (budget: TripBudget) => void;
  currency: Currency;
  numTravelers?: number;
  className?: string;
}

export function BudgetInput({ budget, onChange, currency: _currency, numTravelers = 1, className }: BudgetInputProps) {
  const {
    showAdvanced, setShowAdvanced,
    showSaveDialog, setShowSaveDialog,
    activeSavedProfile,
    handleProfileSaved,
    hasUnsavedChanges,
    toggleAllocation,
    updateTotal,
    updateCategory,
    updateWeight,
    perPersonCost,
    currencySymbol,
    adaptiveDefaults,
    showAdaptiveCallout,
  } = useBudgetController({ budget, onChange, numTravelers });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Fixed/Flexible Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <Label className="text-sm font-medium">Trip Budget</Label>
        </div>

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
            <><Lock className="h-3 w-3" /> Fixed Total</>
          ) : (
            <><Unlock className="h-3 w-3" /> Flexible</>
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

        {/* Advanced: Category Inputs toggle */}
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

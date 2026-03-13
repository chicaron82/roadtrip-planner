/**
 * useBudgetController.ts — Budget state and mutation logic for BudgetInput.
 *
 * Extracts from BudgetInput:
 *  - showAdvanced / showSaveDialog UI state
 *  - activeSavedProfile — tracks which saved profile is active
 *  - applySavedProfile — applies a saved profile to budget
 *  - handleProfileSaved — syncs activeSavedProfile after save
 *  - hasUnsavedChanges — derived flag (show save button)
 *  - toggleAllocation — switches fixed ↔ flexible, recalculates total
 *  - updateTotal — redistributes categories in fixed mode
 *  - updateCategory — proportional redistribution of others in fixed mode
 *  - updateWeight — sum-to-100 scaling of weight sliders
 *  - perPersonCost — derived display value
 *  - showAdaptiveCallout + adaptiveDefaults — adaptive defaults
 *
 * BudgetInput becomes a layout-only component after this.
 *
 * 💚 My Experience Engine
 */

import { useState } from 'react';
import type { TripBudget, BudgetWeights, SavedBudgetProfile } from '../types';
import { applyBudgetWeights, getPerPersonCost } from '../lib/budget';
import { getAdaptiveDefaults, isAdaptiveMeaningful } from '../lib/user-profile';
import type { AdaptiveDefaults } from '../lib/user-profile';

interface UseBudgetControllerOptions {
  budget: TripBudget;
  onChange: (budget: TripBudget) => void;
  numTravelers?: number;
}

export interface UseBudgetControllerReturn {
  // UI state
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  showSaveDialog: boolean;
  setShowSaveDialog: (v: boolean) => void;
  // Profile state
  activeSavedProfile: SavedBudgetProfile | null;
  applySavedProfile: (savedProfile: SavedBudgetProfile) => void;
  handleProfileSaved: (profile: SavedBudgetProfile) => void;
  hasUnsavedChanges: boolean;
  // Budget mutations
  toggleAllocation: () => void;
  updateTotal: (newTotal: number) => void;
  updateCategory: (field: 'gas' | 'hotel' | 'food' | 'misc', value: number) => void;
  updateWeight: (field: 'gas' | 'hotel' | 'food' | 'misc', value: number) => void;
  // Derived display
  perPersonCost: number;
  currencySymbol: string;
  adaptiveDefaults: AdaptiveDefaults | null;
  showAdaptiveCallout: boolean;
}

const BUDGET_FIELDS = ['gas', 'hotel', 'food', 'misc'] as const;
type BudgetField = typeof BUDGET_FIELDS[number];

export function useBudgetController({
  budget,
  onChange,
  numTravelers = 1,
}: UseBudgetControllerOptions): UseBudgetControllerReturn {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeSavedProfile, setActiveSavedProfile] = useState<SavedBudgetProfile | null>(null);

  // ── Profile ──────────────────────────────────────────────────────────────────
  const applySavedProfile = (savedProfile: SavedBudgetProfile) => {
    setActiveSavedProfile(savedProfile);

    const newBudget: TripBudget = {
      ...budget,
      profile: savedProfile.baseProfile,
      weights: savedProfile.weights,
      allocation: savedProfile.allocation,
    };

    if (savedProfile.defaultTotal && savedProfile.defaultTotal > 0) {
      newBudget.total = savedProfile.defaultTotal;
      if (newBudget.allocation === 'fixed') {
        const categories = applyBudgetWeights(newBudget.total, newBudget.weights);
        Object.assign(newBudget, categories);
      }
    }

    onChange(newBudget);
  };

  const handleProfileSaved = (profile: SavedBudgetProfile) => {
    setActiveSavedProfile(profile);
  };

  const hasUnsavedChanges = activeSavedProfile
    ? JSON.stringify(budget.weights) !== JSON.stringify(activeSavedProfile.weights)
    : budget.profile === 'custom' || budget.total > 0;

  // ── Allocation toggle ────────────────────────────────────────────────────────
  const toggleAllocation = () => {
    if (budget.allocation === 'fixed') {
      onChange({ ...budget, allocation: 'flexible' });
    } else {
      // Switching to fixed: recalculate total and lock
      const total = budget.gas + budget.hotel + budget.food + budget.misc;
      // 1000: sensible starting budget for fixed mode when no categories have been entered yet
      onChange({ ...budget, allocation: 'fixed', total: total > 0 ? total : 1000 });
    }
  };

  // ── Total ────────────────────────────────────────────────────────────────────
  const updateTotal = (newTotal: number) => {
    if (budget.allocation === 'fixed') {
      const categories = applyBudgetWeights(newTotal, budget.weights);
      onChange({ ...budget, ...categories, total: newTotal });
    } else {
      onChange({ ...budget, total: newTotal });
    }
  };

  // ── Category ─────────────────────────────────────────────────────────────────
  const updateCategory = (field: BudgetField, value: number) => {
    if (budget.allocation === 'fixed') {
      const others = BUDGET_FIELDS.filter(f => f !== field);
      const othersSum = others.reduce((sum, f) => sum + budget[f], 0);
      const remaining = budget.total - value;

      if (othersSum > 0 && remaining >= 0) {
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
        if (roundingDiff !== 0) newBudget[others[0]] += roundingDiff;

        // Recompute weights as percentages (0–100) to reflect the new split
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
      const newBudget = { ...budget, [field]: value };
      newBudget.total = newBudget.gas + newBudget.hotel + newBudget.food + newBudget.misc;
      onChange(newBudget);
    }
  };

  // ── Weights ──────────────────────────────────────────────────────────────────
  const updateWeight = (field: BudgetField, value: number) => {
    const others = BUDGET_FIELDS.filter(f => f !== field);
    const currentOthersSum = others.reduce((sum, f) => sum + budget.weights[f], 0);
    const maxValue = budget.weights[field] + currentOthersSum;
    const newValue = Math.min(value, maxValue);
    const newOthersSum = 100 - newValue; // all four weights must sum to exactly 100%
    const scale = currentOthersSum > 0 ? newOthersSum / currentOthersSum : 0;

    const newWeights: BudgetWeights = { ...budget.weights, [field]: newValue };
    others.forEach(f => {
      newWeights[f] = Math.round(budget.weights[f] * scale);
    });

    // Fix rounding drift: weights must total exactly 100%; any leftover falls on the first other field
    const sum = newWeights.gas + newWeights.hotel + newWeights.food + newWeights.misc;
    if (sum !== 100) newWeights[others[0]] += 100 - sum;

    if (budget.allocation === 'fixed' && budget.total > 0) {
      const categories = applyBudgetWeights(budget.total, newWeights);
      onChange({ ...budget, profile: 'custom', weights: newWeights, ...categories });
    } else {
      onChange({ ...budget, profile: 'custom', weights: newWeights });
    }
  };

  // ── Derived display values ───────────────────────────────────────────────────
  const perPersonCost = getPerPersonCost(budget.total, numTravelers);
  const currencySymbol = '$';
  const adaptiveDefaults = getAdaptiveDefaults();
  const showAdaptiveCallout = adaptiveDefaults !== null && isAdaptiveMeaningful(adaptiveDefaults);

  return {
    showAdvanced, setShowAdvanced,
    showSaveDialog, setShowSaveDialog,
    activeSavedProfile,
    applySavedProfile,
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
  };
}

/**
 * VehiclePresetCards — Quick-select preset vehicles.
 *
 * Extracted from VehicleForm. Pure display + callback.
 */

import type { Vehicle, UnitSystem } from '../../types';
import { Label } from '../UI/Label';
import { convertL100kmToMpg, convertLitresToGallons } from '../../lib/calculations';

// ==================== PRESET DATA ====================

interface PresetVehicle extends Vehicle {
  emoji: string;
  description: string;
}

const PRESET_VEHICLES: PresetVehicle[] = [
  {
    year: '2024',
    make: 'Toyota',
    model: 'Camry',
    fuelEconomyCity: 8.2,
    fuelEconomyHwy: 6.0,
    tankSize: 60,
    emoji: '🚗',
    description: 'Reliable sedan',
  },
  {
    year: '2024',
    make: 'Ford',
    model: 'F-150',
    fuelEconomyCity: 13.5,
    fuelEconomyHwy: 10.2,
    tankSize: 87,
    emoji: '🛻',
    description: 'Powerful truck',
  },
  {
    year: '2024',
    make: 'Tesla',
    model: 'Model 3',
    fuelEconomyCity: 1.6,
    fuelEconomyHwy: 1.4,
    tankSize: 57.5,
    emoji: '⚡',
    description: 'Electric sedan',
  },
];

// ==================== PROPS ====================

interface VehiclePresetCardsProps {
  units: UnitSystem;
  onSelect: (vehicle: Vehicle, isEV: boolean) => void;
}

// ==================== COMPONENT ====================

export function VehiclePresetCards({ units, onSelect }: VehiclePresetCardsProps) {
  const handlePresetChange = (preset: PresetVehicle) => {
    const updatedPreset = { ...preset };

    if (units === 'imperial') {
      updatedPreset.fuelEconomyCity = Number(convertL100kmToMpg(preset.fuelEconomyCity).toFixed(1));
      updatedPreset.fuelEconomyHwy = Number(convertL100kmToMpg(preset.fuelEconomyHwy).toFixed(1));
      if (preset.tankSize > 0) {
        updatedPreset.tankSize = Number(convertLitresToGallons(preset.tankSize).toFixed(1));
      }
    }

    onSelect(
      {
        year: updatedPreset.year,
        make: updatedPreset.make,
        model: updatedPreset.model,
        fuelEconomyCity: updatedPreset.fuelEconomyCity,
        fuelEconomyHwy: updatedPreset.fuelEconomyHwy,
        tankSize: updatedPreset.tankSize,
      },
      preset.make === 'Tesla',
    );
  };

  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
        Quick Select
      </Label>
      <div className="grid grid-cols-3 gap-2">
        {PRESET_VEHICLES.map((preset, i) => (
          <button
            key={i}
            onClick={() => handlePresetChange(preset)}
            className="group relative p-3 rounded-lg border-2 border-muted hover:border-primary transition-all hover:shadow-md bg-background"
          >
            <div className="text-2xl mb-1">{preset.emoji}</div>
            <div className="text-xs font-medium">{preset.make}</div>
            <div className="text-[10px] text-muted-foreground truncate">{preset.model}</div>
            <div className="text-[9px] text-muted-foreground mt-1">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

import type { Dispatch, SetStateAction } from 'react';
import type { Vehicle, UnitSystem } from '../../types';
import { VehicleGarage } from './VehicleGarage';
import { VehiclePresetCards } from './VehiclePresetCards';
import { useVehicleFormState } from './useVehicleFormState';
import {
  VehicleEfficiencySection,
  VehicleIdentitySection,
  VehiclePowertrainSection,
  VehicleUnitToggle,
} from './VehicleFormSections';

/**
 * VehicleForm — Vehicle configuration orchestrator.
 *
 * Delegates garage management to VehicleGarage and quick presets to
 * VehiclePresetCards. Owns make/model selection, hybrid/EV toggles,
 * fuel economy inputs, and the auto-populate effect.
 */

interface VehicleFormProps {
  vehicle: Vehicle;
  setVehicle: Dispatch<SetStateAction<Vehicle>>;
  units: UnitSystem;
  setUnits: Dispatch<SetStateAction<UnitSystem>>;
}

export function VehicleForm({ vehicle, setVehicle, units, setUnits }: VehicleFormProps) {
  const {
    availableModels,
    handleChange,
    handleGarageSelect,
    handleMakeChange,
    handleModelChange,
    handlePresetSelect,
    isCustomMake,
    isCustomModel,
    isEV,
    isHybrid,
    justAutoPopulated,
    setIsCustomMake,
    setIsCustomModel,
    setIsHybrid,
  } = useVehicleFormState({ vehicle, setVehicle, units });

  return (
    <div className="space-y-6">
      <VehicleUnitToggle units={units} setUnits={setUnits} />
      <VehicleGarage vehicle={vehicle} onSelectVehicle={handleGarageSelect} />
      <VehiclePresetCards units={units} onSelect={handlePresetSelect} />
      <VehicleIdentitySection
        vehicle={vehicle}
        availableModels={availableModels}
        isCustomMake={isCustomMake}
        isCustomModel={isCustomModel}
        onFieldChange={handleChange}
        onMakeChange={handleMakeChange}
        onModelChange={handleModelChange}
        setIsCustomMake={setIsCustomMake}
        setIsCustomModel={setIsCustomModel}
      />
      <VehiclePowertrainSection isEV={isEV} isHybrid={isHybrid} setIsHybrid={setIsHybrid} />
      <VehicleEfficiencySection
        vehicle={vehicle}
        units={units}
        isEV={isEV}
        isCustomModel={isCustomModel}
        justAutoPopulated={justAutoPopulated}
        onFieldChange={handleChange}
      />
    </div>
  );
}

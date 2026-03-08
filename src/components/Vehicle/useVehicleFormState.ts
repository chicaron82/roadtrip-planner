import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Vehicle, UnitSystem } from '../../types';
import { convertL100kmToMpg, convertLitresToGallons } from '../../lib/calculations';
import { getDefaultVehicle, type SavedVehicle } from '../../lib/storage';
import { COMMON_MAKES, VEHICLE_DB } from '../../lib/vehicles';

interface UseVehicleFormStateParams {
  vehicle: Vehicle;
  setVehicle: Dispatch<SetStateAction<Vehicle>>;
  units: UnitSystem;
}

export function useVehicleFormState({ vehicle, setVehicle, units }: UseVehicleFormStateParams) {
  const [isCustomMake, setIsCustomMake] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);
  const [isEV, setIsEV] = useState(false);
  const [justAutoPopulated, setJustAutoPopulated] = useState(false);
  const autoPopTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(autoPopTimerRef.current), []);

  useEffect(() => {
    const defaultVehicle = getDefaultVehicle();
    if (!defaultVehicle) return;

    const { id: _id, name: _name, lastUsed: _lastUsed, isDefault: _isDefault, ...vehicleData } = defaultVehicle;
    setVehicle(vehicleData);
    setIsCustomMake(COMMON_MAKES.indexOf(defaultVehicle.make) === -1);
    setIsCustomModel(!VEHICLE_DB[defaultVehicle.make]?.[defaultVehicle.model]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- empty dep array is intentional; setVehicle is stable
  }, []);

  useEffect(() => {
    if (isCustomMake || isCustomModel) return;

    const makeData = VEHICLE_DB[vehicle.make];
    if (!makeData) return;

    const stats = makeData[vehicle.model];
    if (!stats) return;

    const { isEV: vehicleIsEV } = stats;
    let { city, hwy, tank } = stats;

    setIsEV(!!vehicleIsEV);

    if (isHybrid && !vehicleIsEV) {
      city = Number((city * 0.6).toFixed(1));
      hwy = Number((hwy * 0.9).toFixed(1));
      tank = Number((tank * 0.9).toFixed(0));
    }

    if (units === 'imperial' && !vehicleIsEV) {
      city = Number(convertL100kmToMpg(city).toFixed(1));
      hwy = Number(convertL100kmToMpg(hwy).toFixed(1));
      tank = Number(convertLitresToGallons(tank).toFixed(1));
    }

    setVehicle(prev => ({
      ...prev,
      fuelEconomyCity: city,
      fuelEconomyHwy: hwy,
      tankSize: tank,
    }));

    setJustAutoPopulated(true);
    autoPopTimerRef.current = setTimeout(() => setJustAutoPopulated(false), 1000);
  }, [vehicle.make, vehicle.model, isHybrid, isCustomMake, isCustomModel, setVehicle, units]);

  const handleChange = (field: keyof Vehicle, value: string | number) => {
    if (field === 'year' && typeof value === 'string') {
      const yearNum = parseInt(value);
      const currentYear = new Date().getFullYear();
      // Allow partial input while typing; only reject complete invalid years (4+ digits)
      if (value.length >= 4 && (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 2)) return;
    }

    if ((field === 'fuelEconomyCity' || field === 'fuelEconomyHwy' || field === 'tankSize') && typeof value === 'number') {
      if (value < 0 || value > 1000) return;
    }

    // Functional update so batched calls (e.g. handleMakeChange) chain correctly
    setVehicle(prev => ({ ...prev, [field]: value }));
  };

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Other') {
      setIsCustomMake(true);
      handleChange('make', '');
      setIsCustomModel(true);
      handleChange('model', '');
      return;
    }

    setIsCustomMake(false);
    handleChange('make', value);
    setIsCustomModel(false);
    handleChange('model', '');
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Other') {
      setIsCustomModel(true);
      handleChange('model', '');
      return;
    }

    setIsCustomModel(false);
    handleChange('model', value);
  };

  const handleGarageSelect = (nextVehicle: Vehicle, saved: SavedVehicle) => {
    setVehicle(nextVehicle);
    setIsCustomMake(COMMON_MAKES.indexOf(saved.make) === -1);
    setIsCustomModel(!VEHICLE_DB[saved.make]?.[saved.model]);
  };

  const handlePresetSelect = (presetVehicle: Vehicle, presetIsEV: boolean) => {
    setVehicle(presetVehicle);
    setIsCustomMake(false);
    setIsCustomModel(false);
    setIsHybrid(false);
    setIsEV(presetIsEV);
  };

  const availableModels = VEHICLE_DB[vehicle.make] ? Object.keys(VEHICLE_DB[vehicle.make]) : [];

  return {
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
  };
}
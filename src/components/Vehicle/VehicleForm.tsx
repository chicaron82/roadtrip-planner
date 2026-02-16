/**
 * VehicleForm — Vehicle configuration orchestrator.
 *
 * Delegates garage management to VehicleGarage and quick presets to
 * VehiclePresetCards. Owns make/model selection, hybrid/EV toggles,
 * fuel economy inputs, and the auto-populate effect.
 */

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Vehicle, UnitSystem } from '../../types';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Select } from '../UI/Select';
import { Switch } from '../UI/Switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../UI/Tooltip';
import { VEHICLE_DB, COMMON_MAKES } from '../../lib/vehicles';
import { getDefaultVehicle, type SavedVehicle } from '../../lib/storage';
import { convertL100kmToMpg, convertLitresToGallons } from '../../lib/calculations';
import { X, Zap, Gauge, Fuel, Battery } from 'lucide-react';
import { cn } from '../../lib/utils';

import { VehicleGarage } from './VehicleGarage';
import { VehiclePresetCards } from './VehiclePresetCards';

interface VehicleFormProps {
  vehicle: Vehicle;
  setVehicle: Dispatch<SetStateAction<Vehicle>>;
  units: UnitSystem;
  setUnits: Dispatch<SetStateAction<UnitSystem>>;
}

export function VehicleForm({ vehicle, setVehicle, units, setUnits }: VehicleFormProps) {
  const [isCustomMake, setIsCustomMake] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);
  const [isEV, setIsEV] = useState(false);
  const [justAutoPopulated, setJustAutoPopulated] = useState(false);

  // Load default vehicle on mount
  useEffect(() => {
    const defaultVehicle = getDefaultVehicle();
    if (defaultVehicle) {
      const { id, name, lastUsed, isDefault, ...vehicleData } = defaultVehicle;
      setVehicle(vehicleData);
      setIsCustomMake(COMMON_MAKES.indexOf(defaultVehicle.make) === -1);
      setIsCustomModel(!VEHICLE_DB[defaultVehicle.make]?.[defaultVehicle.model]);
    }
  }, []); // Only on mount

  // Auto-populate stats when Make/Model changes
  useEffect(() => {
    if (isCustomMake || isCustomModel) return;

    const makeData = VEHICLE_DB[vehicle.make];
    if (makeData) {
      const stats = makeData[vehicle.model];
      if (stats) {
        let { city, hwy, tank, isEV: vehicleIsEV } = stats;

        // Set EV flag
        setIsEV(!!vehicleIsEV);

        // Apply Hybrid Heuristic: ~40% better City, ~10% better Hwy
        if (isHybrid && !vehicleIsEV) {
           city = Number((city * 0.6).toFixed(1));
           hwy = Number((hwy * 0.9).toFixed(1));
           tank = Number((tank * 0.9).toFixed(0));
        }

        // Convert to imperial if needed
        if (units === 'imperial' && !vehicleIsEV) {
          city = Number(convertL100kmToMpg(city).toFixed(1));
          hwy = Number(convertL100kmToMpg(hwy).toFixed(1));
          tank = Number(convertLitresToGallons(tank).toFixed(1));
        }

        setVehicle(prev => ({
          ...prev,
          fuelEconomyCity: city,
          fuelEconomyHwy: hwy,
          tankSize: tank
        }));

        // Trigger animation
        setJustAutoPopulated(true);
        setTimeout(() => setJustAutoPopulated(false), 1000);
      }
    }
  }, [vehicle.make, vehicle.model, isHybrid, isCustomMake, isCustomModel, setVehicle, units]);

  const handleChange = (field: keyof Vehicle, value: string | number) => {
    if (field === 'year' && typeof value === 'string') {
      const yearNum = parseInt(value);
      const currentYear = new Date().getFullYear();
      if (value !== '' && (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 2)) return;
    }
    if ((field === 'fuelEconomyCity' || field === 'fuelEconomyHwy' || field === 'tankSize') && typeof value === 'number') {
      if (value < 0 || value > 1000) return;
    }
    setVehicle({ ...vehicle, [field]: value });
  };

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Other') {
      setIsCustomMake(true);
      handleChange('make', '');
      setIsCustomModel(true);
      handleChange('model', '');
    } else {
      setIsCustomMake(false);
      handleChange('make', value);
      setIsCustomModel(false);
      handleChange('model', '');
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'Other') {
      setIsCustomModel(true);
      handleChange('model', '');
    } else {
      setIsCustomModel(false);
      handleChange('model', value);
    }
  };

  const handleGarageSelect = (_vehicle: Vehicle, saved: SavedVehicle) => {
    setVehicle(_vehicle);
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

  // Determine available models based on selected make
  const availableModels = VEHICLE_DB[vehicle.make] ? Object.keys(VEHICLE_DB[vehicle.make]) : [];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Unit Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Units</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs", units === 'metric' ? 'text-primary font-medium' : 'text-muted-foreground')}>
              Metric
            </span>
            <Switch
              checked={units === 'imperial'}
              onCheckedChange={(checked) => setUnits(checked ? 'imperial' : 'metric')}
            />
            <span className={cn("text-xs", units === 'imperial' ? 'text-primary font-medium' : 'text-muted-foreground')}>
              Imperial
            </span>
          </div>
        </div>

        {/* Garage */}
        <VehicleGarage vehicle={vehicle} onSelectVehicle={handleGarageSelect} />

        {/* Quick Select Presets */}
        <VehiclePresetCards units={units} onSelect={handlePresetSelect} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Year</Label>
            <Input
              value={vehicle.year}
              onChange={(e) => handleChange('year', e.target.value)}
              className="mt-1"
              placeholder="YYYY"
            />
          </div>

          {/* Make Selection */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground">Make</Label>
            {isCustomMake ? (
               <div className="relative mt-1">
                 <Input
                   value={vehicle.make}
                   onChange={(e) => handleChange('make', e.target.value)}
                   placeholder="Enter Make"
                   autoFocus
                 />
                 <button
                  onClick={() => setIsCustomMake(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Back to list"
                 >
                   <X className="h-4 w-4" />
                 </button>
               </div>
            ) : (
              <Select
                value={COMMON_MAKES.includes(vehicle.make) ? vehicle.make : 'Other'}
                onChange={handleMakeChange}
                className="mt-1"
              >
                <option value="" disabled>Select Make</option>
                {COMMON_MAKES.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
                <option value="Other">Other...</option>
              </Select>
            )}
          </div>

          {/* Model Selection */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground">Model</Label>
            {isCustomModel || isCustomMake ? (
              <div className="relative mt-1">
                <Input
                  value={vehicle.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  placeholder="Enter Model"
                />
                 {!isCustomMake && (
                   <button
                    onClick={() => setIsCustomModel(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Back to list"
                   >
                     <X className="h-4 w-4" />
                   </button>
                 )}
              </div>
            ) : (
              <Select
                value={availableModels.includes(vehicle.model) ? vehicle.model : 'Other'}
                onChange={handleModelChange}
                className="mt-1"
                disabled={!vehicle.make || availableModels.length === 0}
              >
                <option value="" disabled>Select Model</option>
                {availableModels.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
                <option value="Other">Other...</option>
              </Select>
            )}
          </div>
        </div>

        {/* Hybrid Toggle - Only show for non-EV vehicles */}
        {!isEV && (
          <div className="flex items-center space-x-2 py-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsHybrid(!isHybrid)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
                    isHybrid
                      ? 'bg-green-100 text-green-700 border-green-200 shadow-sm dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-muted hover:shadow-sm'
                  )}
                >
                  <Zap className={cn("h-4 w-4", isHybrid && "fill-current")} />
                  {isHybrid ? 'Hybrid Mode Active' : 'Enable Hybrid Mode'}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold mb-1">Hybrid Efficiency Boost</div>
                  <div>🌿 City: -40% fuel consumption</div>
                  <div>🛣️ Highway: -10% fuel consumption</div>
                </div>
              </TooltipContent>
            </Tooltip>
            {isHybrid && (
              <span className="text-xs text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-left-2">
                ✨ Stats optimized for hybrid efficiency
              </span>
            )}
          </div>
        )}

        {/* EV Indicator */}
        {isEV && (
          <div className="flex items-center space-x-2 py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
              <Battery className="h-4 w-4 fill-current" />
              Electric Vehicle
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              {isEV ? (
                <>
                  <Zap className="h-3 w-3" />
                  City (kWh/100km)
                </>
              ) : (
                <>
                  <Fuel className="h-3 w-3" />
                  City {units === 'metric' ? '(L/100km)' : '(MPG)'}
                </>
              )}
              {vehicle.make && vehicle.model && !isCustomModel && (
                <span className="text-blue-500 ml-1 text-[10px]">(Auto)</span>
              )}
            </Label>
            <Input
              type="number"
              value={vehicle.fuelEconomyCity}
              onChange={(e) => handleChange('fuelEconomyCity', parseFloat(e.target.value) || 0)}
              className={cn(
                "mt-1 transition-all",
                justAutoPopulated && "ring-2 ring-green-500/50 animate-pulse"
              )}
            />
          </div>
          <div>
             <Label className="text-xs text-muted-foreground flex items-center gap-1">
              {isEV ? (
                <>
                  <Zap className="h-3 w-3" />
                  Highway (kWh/100km)
                </>
              ) : (
                <>
                  <Fuel className="h-3 w-3" />
                  Highway {units === 'metric' ? '(L/100km)' : '(MPG)'}
                </>
              )}
              {vehicle.make && vehicle.model && !isCustomModel && (
                <span className="text-blue-500 ml-1 text-[10px]">(Auto)</span>
              )}
            </Label>
            <Input
              type="number"
              value={vehicle.fuelEconomyHwy}
              onChange={(e) => handleChange('fuelEconomyHwy', parseFloat(e.target.value) || 0)}
              className={cn(
                "mt-1 transition-all",
                justAutoPopulated && "ring-2 ring-green-500/50 animate-pulse"
              )}
            />
          </div>
        </div>

         <div>
             <Label className="text-xs text-muted-foreground flex items-center gap-1">
              {isEV ? (
                <>
                  <Battery className="h-3 w-3" />
                  Battery Capacity (kWh)
                </>
              ) : (
                <>
                  <Fuel className="h-3 w-3" />
                  Tank Size {units === 'metric' ? '(Litres)' : '(Gallons)'}
                </>
              )}
            </Label>
            <Input
              type="number"
              value={vehicle.tankSize}
              onChange={(e) => handleChange('tankSize', parseFloat(e.target.value) || 0)}
              className={cn(
                "mt-1 transition-all",
                justAutoPopulated && "ring-2 ring-green-500/50 animate-pulse"
              )}
            />
          </div>

      </div>
    </TooltipProvider>
  );
}

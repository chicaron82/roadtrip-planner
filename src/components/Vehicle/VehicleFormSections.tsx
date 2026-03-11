import { Battery, Fuel, Gauge, X, Zap } from 'lucide-react';
import type { UnitSystem, Vehicle } from '../../types';
import { COMMON_MAKES } from '../../lib/vehicles';
import { cn } from '../../lib/utils';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Select } from '../UI/Select';
import { Switch } from '../UI/Switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '../UI/Tooltip';

interface VehicleUnitToggleProps {
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
}

export function VehicleUnitToggle({ units, setUnits }: VehicleUnitToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Units</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs', units === 'metric' ? 'text-primary font-medium' : 'text-muted-foreground')}>
          Metric
        </span>
        <Switch
          aria-label="Toggle imperial units"
          checked={units === 'imperial'}
          onCheckedChange={(checked) => setUnits(checked ? 'imperial' : 'metric')}
        />
        <span className={cn('text-xs', units === 'imperial' ? 'text-primary font-medium' : 'text-muted-foreground')}>
          Imperial
        </span>
      </div>
    </div>
  );
}

interface VehicleIdentitySectionProps {
  vehicle: Vehicle;
  availableModels: string[];
  isCustomMake: boolean;
  isCustomModel: boolean;
  onFieldChange: (field: keyof Vehicle, value: string | number) => void;
  onMakeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onModelChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  setIsCustomMake: (value: boolean) => void;
  setIsCustomModel: (value: boolean) => void;
}

export function VehicleIdentitySection({
  vehicle,
  availableModels,
  isCustomMake,
  isCustomModel,
  onFieldChange,
  onMakeChange,
  onModelChange,
  setIsCustomMake,
  setIsCustomModel,
}: VehicleIdentitySectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <div>
        <Label className="text-xs text-muted-foreground">Year</Label>
        <Input
          value={vehicle.year}
          onChange={(e) => onFieldChange('year', e.target.value)}
          className="mt-1"
          placeholder="YYYY"
        />
      </div>

      <div className="relative">
        <Label className="text-xs text-muted-foreground">Make</Label>
        {isCustomMake ? (
          <div className="relative mt-1">
            <Input
              value={vehicle.make}
              onChange={(e) => onFieldChange('make', e.target.value)}
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
            onChange={onMakeChange}
            className="mt-1"
          >
            <option value="" disabled>Select Make</option>
            {COMMON_MAKES.map((make) => (
              <option key={make} value={make}>{make}</option>
            ))}
            <option value="Other">Other...</option>
          </Select>
        )}
      </div>

      <div className="relative">
        <Label className="text-xs text-muted-foreground">Model</Label>
        {isCustomModel || isCustomMake ? (
          <div className="relative mt-1">
            <Input
              value={vehicle.model}
              onChange={(e) => onFieldChange('model', e.target.value)}
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
            onChange={onModelChange}
            className="mt-1"
            disabled={!vehicle.make || availableModels.length === 0}
          >
            <option value="" disabled>Select Model</option>
            {availableModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
            <option value="Other">Other...</option>
          </Select>
        )}
      </div>
    </div>
  );
}

interface VehiclePowertrainSectionProps {
  isEV: boolean;
  isHybrid: boolean;
  setIsHybrid: (value: boolean) => void;
}

export function VehiclePowertrainSection({ isEV, isHybrid, setIsHybrid }: VehiclePowertrainSectionProps) {
  return (
    <>
      {!isEV && (
        <div className="flex items-center space-x-2 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsHybrid(!isHybrid)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
                  isHybrid
                    ? 'bg-green-100 text-green-700 border-green-200 shadow-sm dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                    : 'bg-transparent text-muted-foreground border-border hover:bg-muted hover:shadow-sm'
                )}
              >
                <Zap className={cn('h-4 w-4', isHybrid && 'fill-current')} />
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

      {isEV && (
        <div className="flex items-center space-x-2 py-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200 shadow-sm dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <Battery className="h-4 w-4 fill-current" />
            Electric Vehicle
          </div>
        </div>
      )}
    </>
  );
}

interface VehicleEfficiencySectionProps {
  vehicle: Vehicle;
  units: UnitSystem;
  isEV: boolean;
  isCustomModel: boolean;
  justAutoPopulated: boolean;
  onFieldChange: (field: keyof Vehicle, value: string | number) => void;
}

export function VehicleEfficiencySection({
  vehicle,
  units,
  isEV,
  isCustomModel,
  justAutoPopulated,
  onFieldChange,
}: VehicleEfficiencySectionProps) {
  return (
    <>
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
            onChange={(e) => onFieldChange('fuelEconomyCity', parseFloat(e.target.value) || 0)}
            className={cn('mt-1 transition-all', justAutoPopulated && 'ring-2 ring-green-500/50 animate-pulse')}
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
            onChange={(e) => onFieldChange('fuelEconomyHwy', parseFloat(e.target.value) || 0)}
            className={cn('mt-1 transition-all', justAutoPopulated && 'ring-2 ring-green-500/50 animate-pulse')}
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
          onChange={(e) => onFieldChange('tankSize', parseFloat(e.target.value) || 0)}
          className={cn('mt-1 transition-all', justAutoPopulated && 'ring-2 ring-green-500/50 animate-pulse')}
        />
      </div>
    </>
  );
}
import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Vehicle, UnitSystem } from '../../types';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Select } from '../UI/Select';
import { Button } from '../UI/Button';
import { Switch } from '../UI/Switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../UI/Dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../UI/Tooltip';
import { VEHICLE_DB, COMMON_MAKES } from '../../lib/vehicles';
import { getGarage, saveToGarage, removeFromGarage, setDefaultVehicleId, getDefaultVehicle, type SavedVehicle } from '../../lib/storage';
import { convertL100kmToMpg, convertLitresToGallons } from '../../lib/calculations';
import { X, Zap, Save, Trash2, Car, Star, Gauge, Fuel, Battery } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VehicleFormProps {
  vehicle: Vehicle;
  setVehicle: Dispatch<SetStateAction<Vehicle>>;
  units: UnitSystem;
  setUnits: Dispatch<SetStateAction<UnitSystem>>;
}

const PRESET_VEHICLES: (Vehicle & { emoji: string; description: string })[] = [
  {
    year: "2024",
    make: "Toyota",
    model: "Camry",
    fuelEconomyCity: 8.2,
    fuelEconomyHwy: 6.0,
    tankSize: 60,
    emoji: "🚗",
    description: "Reliable sedan"
  },
  {
    year: "2024",
    make: "Ford",
    model: "F-150",
    fuelEconomyCity: 13.5,
    fuelEconomyHwy: 10.2,
    tankSize: 87,
    emoji: "🛻",
    description: "Powerful truck"
  },
  {
    year: "2024",
    make: "Tesla",
    model: "Model 3",
    fuelEconomyCity: 1.6,
    fuelEconomyHwy: 1.4,
    tankSize: 57.5,
    emoji: "⚡",
    description: "Electric sedan"
  },
];

export function VehicleForm({ vehicle, setVehicle, units, setUnits }: VehicleFormProps) {
  const [isCustomMake, setIsCustomMake] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);
  const [isEV, setIsEV] = useState(false);
  const [justAutoPopulated, setJustAutoPopulated] = useState(false);

  // Garage State
  const [garage, setGarage] = useState<SavedVehicle[]>(() => getGarage());
  const [garageId, setGarageId] = useState<string>("");

  // Dialog State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState("");

  // Load default vehicle on mount
  useEffect(() => {
    const defaultVehicle = getDefaultVehicle();
    if (defaultVehicle) {
      const { id, name, lastUsed, isDefault, ...vehicleData } = defaultVehicle;
      setVehicle(vehicleData);
      setGarageId(id);
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

  const handlePresetChange = (preset: typeof PRESET_VEHICLES[0]) => {
    let updatedPreset = { ...preset };

    // Convert to imperial if needed
    if (units === 'imperial') {
      updatedPreset.fuelEconomyCity = Number(convertL100kmToMpg(preset.fuelEconomyCity).toFixed(1));
      updatedPreset.fuelEconomyHwy = Number(convertL100kmToMpg(preset.fuelEconomyHwy).toFixed(1));
      if (preset.tankSize > 0) {
        updatedPreset.tankSize = Number(convertLitresToGallons(preset.tankSize).toFixed(1));
      }
    }

    setVehicle({
      year: updatedPreset.year,
      make: updatedPreset.make,
      model: updatedPreset.model,
      fuelEconomyCity: updatedPreset.fuelEconomyCity,
      fuelEconomyHwy: updatedPreset.fuelEconomyHwy,
      tankSize: updatedPreset.tankSize
    });
    setIsCustomMake(false);
    setIsCustomModel(false);
    setIsHybrid(false);
    setIsEV(preset.make === "Tesla");
    setGarageId("");
  };

  const handleGarageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setGarageId(id);
      const saved = garage.find(v => v.id === id);
      if (saved) {
          // Remove id/name from the vehicle state to avoid pollution
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, name: _name, lastUsed: _lastUsed, isDefault: _isDefault, ...vehicleData } = saved;
          setVehicle(vehicleData);
          setIsCustomMake(COMMON_MAKES.indexOf(saved.make) === -1);
          setIsCustomModel(!VEHICLE_DB[saved.make]?.[saved.model]);
      }
  };

  const handleSaveToGarage = () => {
      setVehicleName(`${vehicle.year} ${vehicle.make} ${vehicle.model}`);
      setSaveDialogOpen(true);
  };

  const confirmSaveToGarage = () => {
      if (vehicleName.trim()) {
          const newSaved: SavedVehicle = {
              ...vehicle,
              id: crypto.randomUUID(),
              name: vehicleName,
              lastUsed: new Date().toISOString()
          };
          const updatedGarage = saveToGarage(newSaved);
          setGarage(updatedGarage);
          setGarageId(newSaved.id);
          setSaveDialogOpen(false);
          setVehicleName("");
      }
  };

  const handleDeleteFromGarage = () => {
      if (garageId) {
          setDeleteDialogOpen(true);
      }
  };

  const confirmDeleteFromGarage = () => {
      if (garageId) {
          const updated = removeFromGarage(garageId);
          setGarage(updated);
          setGarageId("");
          setDeleteDialogOpen(false);
      }
  };

  const handleSetDefault = (id: string) => {
    setDefaultVehicleId(id);
    setGarage(getGarage()); // Refresh to show updated default status
  };

  const handleChange = (field: keyof Vehicle, value: string | number) => {
    // Validate year input
    if (field === 'year' && typeof value === 'string') {
      const yearNum = parseInt(value);
      const currentYear = new Date().getFullYear();
      if (value !== '' && (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 2)) {
        return; // Don't update if invalid
      }
    }

    // Validate numeric inputs
    if ((field === 'fuelEconomyCity' || field === 'fuelEconomyHwy' || field === 'tankSize') && typeof value === 'number') {
      if (value < 0 || value > 1000) {
        return; // Don't update if out of range
      }
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

  const formatLastUsed = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Determine available models based on selected make
  const availableModels = VEHICLE_DB[vehicle.make] ? Object.keys(VEHICLE_DB[vehicle.make]) : [];

  // Sort garage: default first, then by last used
  const sortedGarage = [...garage].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
    const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
    return bTime - aTime;
  });

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

        {/* Garage Section */}
        <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-primary/20">
          <label className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
              <Car className="h-3 w-3" /> The Garage
          </label>
          <div className="flex gap-2">
              <Select
                value={garageId}
                onChange={handleGarageChange}
                className="flex-1 bg-background"
              >
                <option value="">-- Load from Garage --</option>
                {sortedGarage.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.isDefault ? '⭐ ' : ''}{v.name} {v.lastUsed && `• ${formatLastUsed(v.lastUsed)}`}
                    </option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={handleSaveToGarage} title="Save Current to Garage">
                  <Save className="h-4 w-4" />
              </Button>
               {garageId && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(garageId)}
                        className={cn(
                          "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50",
                          garage.find(v => v.id === garageId)?.isDefault && "bg-yellow-100"
                        )}
                      >
                        <Star className={cn("h-4 w-4", garage.find(v => v.id === garageId)?.isDefault && "fill-current")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Set as default vehicle</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="icon" onClick={handleDeleteFromGarage} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                  </Button>
                </>
            )}
          </div>
        </div>

        {/* Quick Select - Visual Cards */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Quick Select</Label>
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

        {/* Save Vehicle Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save to Garage</DialogTitle>
              <DialogDescription>
                Give this vehicle a memorable name to save it to your garage.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="vehicle-name" className="text-sm">Vehicle Name</Label>
              <Input
                id="vehicle-name"
                value={vehicleName}
                onChange={(e) => setVehicleName(e.target.value)}
                placeholder="e.g., My Truck, Family Van"
                className="mt-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmSaveToGarage();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmSaveToGarage} disabled={!vehicleName.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Vehicle Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove from Garage?</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this vehicle from your garage? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteFromGarage}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

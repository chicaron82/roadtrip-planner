
import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Vehicle, UnitSystem } from '../../types';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Select } from '../UI/Select';
import { Button } from '../UI/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../UI/Dialog';
import { VEHICLE_DB, COMMON_MAKES } from '../../lib/vehicles';
import { getGarage, saveToGarage, removeFromGarage, type SavedVehicle } from '../../lib/storage';
import { convertL100kmToMpg, convertMpgToL100km, convertLitresToGallons, convertGallonsToLitres } from '../../lib/calculations';
import { X, Zap, Save, Trash2, Car } from 'lucide-react';

interface VehicleFormProps {
  vehicle: Vehicle;
  setVehicle: Dispatch<SetStateAction<Vehicle>>;
  units: UnitSystem;
}

const PRESET_VEHICLES: Vehicle[] = [
  { year: "2024", make: "Toyota", model: "Camry", fuelEconomyCity: 8.2, fuelEconomyHwy: 6.0, tankSize: 60 },
  { year: "2024", make: "Ford", model: "F-150", fuelEconomyCity: 13.5, fuelEconomyHwy: 10.2, tankSize: 87 },
  { year: "2024", make: "Tesla", model: "Model 3", fuelEconomyCity: 1.6, fuelEconomyHwy: 1.4, tankSize: 0 }, 
];

export function VehicleForm({ vehicle, setVehicle, units }: VehicleFormProps) {
  const [isCustomMake, setIsCustomMake] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);
  const [isEV, setIsEV] = useState(false);

  // Garage State
  const [garage, setGarage] = useState<SavedVehicle[]>(() => getGarage());
  const [garageId, setGarageId] = useState<string>("");

  // Dialog State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState("");

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
      }
    }
  }, [vehicle.make, vehicle.model, isHybrid, isCustomMake, isCustomModel, setVehicle, units]);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value);
    if (!isNaN(index)) {
      let preset = { ...PRESET_VEHICLES[index] };

      // Convert to imperial if needed
      if (units === 'imperial') {
        preset.fuelEconomyCity = Number(convertL100kmToMpg(preset.fuelEconomyCity).toFixed(1));
        preset.fuelEconomyHwy = Number(convertL100kmToMpg(preset.fuelEconomyHwy).toFixed(1));
        if (preset.tankSize > 0) {
          preset.tankSize = Number(convertLitresToGallons(preset.tankSize).toFixed(1));
        }
      }

      setVehicle(preset);
      setIsCustomMake(false);
      setIsCustomModel(false);
      setIsHybrid(false);
      setIsEV(preset.make === "Tesla");
      setGarageId("");
    }
  };
  
  const handleGarageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setGarageId(id);
      const saved = garage.find(v => v.id === id);
      if (saved) {
          // Remove id/name from the vehicle state to avoid pollution
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, name: _name, ...vehicleData } = saved;
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
              name: vehicleName
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

  // Determine available models based on selected make
  const availableModels = VEHICLE_DB[vehicle.make] ? Object.keys(VEHICLE_DB[vehicle.make]) : [];

  return (
    <div className="space-y-6">
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
                {garage.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                ))}
            </Select>
            <Button variant="outline" size="icon" onClick={handleSaveToGarage} title="Save Current to Garage">
                <Save className="h-4 w-4" />
            </Button>
             {garageId && (
                <Button variant="ghost" size="icon" onClick={handleDeleteFromGarage} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Quick Select</Label>
        <Select 
          onChange={handlePresetChange}
          defaultValue=""
          className="bg-muted/50"
        >
          <option value="" disabled>Choose a popular vehicle...</option>
          {PRESET_VEHICLES.map((v, i) => (
            <option key={i} value={i}>{v.year} {v.make} {v.model}</option>
          ))}
        </Select>
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
          <button
            type="button"
            onClick={() => setIsHybrid(!isHybrid)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${isHybrid ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-transparent text-muted-foreground border-border hover:bg-muted'}`}
          >
            <Zap className={`h-4 w-4 ${isHybrid ? 'fill-current' : ''}`} />
            {isHybrid ? 'Hybrid Mode Active' : 'Enable Hybrid Mode'}
          </button>
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <Zap className="h-4 w-4 fill-current" />
            Electric Vehicle
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">
            {isEV ? 'City (kWh/100km)' : `City ${units === 'metric' ? '(L/100km)' : '(MPG)'}`} {vehicle.make && vehicle.model && !isCustomModel && <span className="text-blue-500 ml-1 text-[10px]">(Auto)</span>}
          </Label>
          <Input
            type="number"
            value={vehicle.fuelEconomyCity}
            onChange={(e) => handleChange('fuelEconomyCity', parseFloat(e.target.value) || 0)}
            className="mt-1"
          />
        </div>
        <div>
           <Label className="text-xs text-muted-foreground">
            {isEV ? 'Highway (kWh/100km)' : `Highway ${units === 'metric' ? '(L/100km)' : '(MPG)'}`} {vehicle.make && vehicle.model && !isCustomModel && <span className="text-blue-500 ml-1 text-[10px]">(Auto)</span>}
          </Label>
          <Input
            type="number"
            value={vehicle.fuelEconomyHwy}
            onChange={(e) => handleChange('fuelEconomyHwy', parseFloat(e.target.value) || 0)}
            className="mt-1"
          />
        </div>
      </div>

       <div>
           <Label className="text-xs text-muted-foreground">
            {isEV ? 'Battery Capacity (kWh)' : `Tank Size ${units === 'metric' ? '(Litres)' : '(Gallons)'}`}
          </Label>
          <Input
            type="number"
            value={vehicle.tankSize}
            onChange={(e) => handleChange('tankSize', parseFloat(e.target.value) || 0)}
            className="mt-1"
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
  );
}

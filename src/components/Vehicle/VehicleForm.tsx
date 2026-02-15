import type { Vehicle, UnitSystem } from '../../types';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';

interface VehicleFormProps {
  vehicle: Vehicle;
  setVehicle: (v: Vehicle) => void;
  units: UnitSystem;
}

const PRESET_VEHICLES: Vehicle[] = [
  { year: "2024", make: "Toyota", model: "Camry", fuelEconomyCity: 8.7, fuelEconomyHwy: 6.2, tankSize: 60 },
  { year: "2024", make: "Honda", model: "Civic", fuelEconomyCity: 8.0, fuelEconomyHwy: 5.9, tankSize: 47 },
  { year: "2024", make: "Ford", model: "F-150", fuelEconomyCity: 13.8, fuelEconomyHwy: 10.7, tankSize: 98 },
  { year: "2024", make: "Tesla", model: "Model 3", fuelEconomyCity: 1.6, fuelEconomyHwy: 1.4, tankSize: 0 }, // Electric handling might need work in calculations
];

export function VehicleForm({ vehicle, setVehicle, units }: VehicleFormProps) {
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value);
    if (!isNaN(index)) {
      setVehicle(PRESET_VEHICLES[index]);
    }
  };

  const handleChange = (field: keyof Vehicle, value: string | number) => {
    setVehicle({ ...vehicle, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Quick Select</Label>
        <select 
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          onChange={handlePresetChange}
          defaultValue=""
        >
          <option value="" disabled>Choose a popular vehicle...</option>
          {PRESET_VEHICLES.map((v, i) => (
            <option key={i} value={i}>{v.year} {v.make} {v.model}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Input 
            value={vehicle.year} 
            onChange={(e) => handleChange('year', e.target.value)} 
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Make</Label>
          <Input 
            value={vehicle.make} 
            onChange={(e) => handleChange('make', e.target.value)} 
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Model</Label>
          <Input 
            value={vehicle.model} 
            onChange={(e) => handleChange('model', e.target.value)} 
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">
            City {units === 'metric' ? '(L/100km)' : '(MPG)'}
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
            Highway {units === 'metric' ? '(L/100km)' : '(MPG)'}
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
            Tank Size {units === 'metric' ? '(Litres)' : '(Gallons)'}
          </Label>
          <Input 
            type="number" 
            value={vehicle.tankSize} 
            onChange={(e) => handleChange('tankSize', parseFloat(e.target.value) || 0)} 
            className="mt-1"
          />
        </div>
    </div>
  );
}

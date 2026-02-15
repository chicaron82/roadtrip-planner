import type { TripSettings } from '../../types';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Button } from '../UI/Button';
// import { Slider } from '../UI/Slider'; 
// I haven't created Slider.tsx yet but I installed @radix-ui/react-slider. 
// I'll create it or use standard input range for now to be safe. 
// Actually I'll use a range input for simplicity in this pass.

interface SettingsFormProps {
  settings: TripSettings;
  setSettings: (s: TripSettings) => void;
}

export function SettingsForm({ settings, setSettings }: SettingsFormProps) {
  const handleChange = (field: keyof TripSettings, value: string | number) => {
    setSettings({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Units</Label>
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-1">
          <Button 
            variant={settings.units === 'metric' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handleChange('units', 'metric')}
            className="h-7 text-xs"
          >
            km / L
          </Button>
          <Button 
            variant={settings.units === 'imperial' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handleChange('units', 'imperial')}
            className="h-7 text-xs"
          >
            mi / gal
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Currency</Label>
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-1">
          <Button 
            variant={settings.currency === 'CAD' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handleChange('currency', 'CAD')}
            className="h-7 text-xs"
          >
            🇨🇦 CAD
          </Button>
          <Button 
            variant={settings.currency === 'USD' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handleChange('currency', 'USD')}
            className="h-7 text-xs"
          >
            🇺🇸 USD
          </Button>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
            <Label className="text-sm font-medium">Max Drive Time / Day</Label>
            <span className="font-mono text-sm bg-secondary px-2 rounded">{settings.maxDriveHours}h</span>
        </div>
        <input 
            type="range"
            min={2}
            max={16}
            step={0.5}
            value={settings.maxDriveHours}
            onChange={(e) => handleChange('maxDriveHours', parseFloat(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>2h</span>
            <span>8h</span>
            <span>16h</span>
        </div>
      </div>

       <div className="grid grid-cols-2 gap-3">
        <div>
            <Label className="text-xs text-muted-foreground">Travelers</Label>
             <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleChange('numTravelers', Math.max(1, settings.numTravelers - 1))}>-</Button>
                <div className="font-bold text-lg w-8 text-center">{settings.numTravelers}</div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleChange('numTravelers', settings.numTravelers + 1)}>+</Button>
             </div>
        </div>
        <div>
            <Label className="text-xs text-muted-foreground">Drivers</Label>
             <div className="flex items-center gap-2 mt-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleChange('numDrivers', Math.max(1, settings.numDrivers - 1))}>-</Button>
                 <div className="font-bold text-lg w-8 text-center">{settings.numDrivers}</div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleChange('numDrivers', Math.min(settings.numTravelers, settings.numDrivers + 1))}>+</Button>
             </div>
        </div>
       </div>

       <div>
           <Label className="text-xs text-muted-foreground">
                Gas Price ({settings.currency === 'CAD' ? '$/L' : '$/gal'})
           </Label>
           <Input 
                type="number"
                step="0.01"
                value={settings.gasPrice}
                onChange={(e) => handleChange('gasPrice', parseFloat(e.target.value) || 0)}
                className="mt-1"
           />
       </div>

       <div>
        <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Budget Mode</Label>
             <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-1">
                <Button 
                    variant={settings.budgetMode === 'open' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => handleChange('budgetMode', 'open')}
                    className="h-7 text-xs"
                >
                    Open
                </Button>
                 <Button 
                    variant={settings.budgetMode === 'fixed' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => handleChange('budgetMode', 'fixed')}
                    className="h-7 text-xs"
                >
                    Fixed
                </Button>
             </div>
        </div>
        {settings.budgetMode === 'fixed' && (
             <Input 
                type="number"
                placeholder="Total budget..."
                value={settings.budget || ''}
                onChange={(e) => handleChange('budget', parseFloat(e.target.value) || 0)}
           />
        )}
       </div>
    </div>
  );
}

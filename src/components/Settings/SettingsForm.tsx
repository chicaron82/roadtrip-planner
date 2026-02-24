import type { TripSettings } from '../../types';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Button } from '../UI/Button';
import { Switch } from '../UI/Switch';
import { ClockPicker } from '../UI/ClockPicker';
import { RoutePreferenceCards } from './RoutePreferenceCards';
import { Repeat } from 'lucide-react';

interface SettingsFormProps {
  settings: TripSettings;
  setSettings: (s: TripSettings) => void;
}

export function SettingsForm({ settings, setSettings }: SettingsFormProps) {
  const handleChange = (field: keyof TripSettings, value: string | number | boolean) => {
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

      <div className="pt-2 border-t">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Schedule</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <Input 
                        type="date" 
                        value={settings.departureDate} 
                        onChange={(e) => handleChange('departureDate', e.target.value)} 
                        className="mt-1"
                  />
              </div>
              <div>
                  <Label className="text-xs text-muted-foreground">{settings.useArrivalTime ? "Depart By (Calc)" : "Depart At"}</Label>
                  <ClockPicker
                    value={settings.departureTime}
                    onChange={(v) => handleChange('departureTime', v)}
                    disabled={settings.useArrivalTime}
                  />
              </div>
          </div>
          
           <div className="flex items-center justify-between mt-3">
             <Label className="cursor-pointer text-sm" htmlFor="use-arrival-time">Plan by Arrival Time?</Label>
             <button 
               id="use-arrival-time"
               onClick={() => handleChange('useArrivalTime', !settings.useArrivalTime)}
               className={`w-11 h-6 flex items-center rounded-full px-1 transition-colors ${settings.useArrivalTime ? 'bg-primary' : 'bg-muted'}`}
             >
               <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.useArrivalTime ? 'translate-x-5' : 'translate-x-0'}`} />
             </button>
           </div>

           {settings.useArrivalTime && (
             <div className="grid grid-cols-2 gap-3 mt-3 animate-in slide-in-from-top-2 fade-in duration-300">
                <div>
                  <Label className="text-xs text-muted-foreground">Arrival Date</Label>
                  <Input 
                        type="date" 
                        value={settings.arrivalDate} 
                        onChange={(e) => handleChange('arrivalDate', e.target.value)} 
                        className="mt-1"
                  />
              </div>
              <div>
                  <Label className="text-xs text-muted-foreground">Arrive By</Label>
                  <ClockPicker
                    value={settings.arrivalTime || '17:00'}
                    onChange={(v) => handleChange('arrivalTime', v)}
                  />
              </div>
             </div>
           )}
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

      {/* Beast Mode */}
      <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${settings.beastMode ? 'bg-amber-50 border-amber-300' : 'bg-muted/20 border-border'}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">🔥</span>
          <div>
            <Label className="cursor-pointer font-medium text-sm" htmlFor="beast-mode">
              Beast Mode
            </Label>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {settings.beastMode ? 'Drive-time cap bypassed — relay team only' : 'Override the overnight cap for marathon drives'}
            </p>
          </div>
        </div>
        <Switch
          id="beast-mode"
          checked={settings.beastMode ?? false}
          onCheckedChange={(checked) => handleChange('beastMode', checked)}
        />
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
                    variant={settings.budgetMode === 'plan-to-budget' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleChange('budgetMode', 'plan-to-budget')}
                    className="h-7 text-xs"
                >
                    Plan to Budget
                </Button>
             </div>
        </div>
        {settings.budgetMode === 'plan-to-budget' && (
             <div className="text-xs text-muted-foreground">
               Budget: ${settings.budget.total || 0} total
               <span className="ml-2">(Gas: ${settings.budget.gas}, Hotel: ${settings.budget.hotel}, Food: ${settings.budget.food})</span>
             </div>
        )}
       </div>

       {/* Route Preferences */}
       <div className="space-y-4 pt-2 border-t">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Route Preferences</Label>

          {/* Route Preference Cards */}
          <RoutePreferenceCards
            value={settings.routePreference}
            onChange={(value) => handleChange('routePreference', value)}
          />

          {/* Auto Return Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <Label className="cursor-pointer font-medium" htmlFor="round-trip">
                Auto Return
              </Label>
              {settings.isRoundTrip && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                  ×2
                </span>
              )}
            </div>
            <Switch
              id="round-trip"
              checked={settings.isRoundTrip}
              onCheckedChange={(checked) => handleChange('isRoundTrip', checked)}
            />
          </div>

          {settings.isRoundTrip && (
            <div className="text-xs text-muted-foreground pl-9 -mt-2 animate-in slide-in-from-top-1 fade-in">
              ✨ Trip ends where it started — distance and cost doubled
            </div>
          )}
       </div>

       {/* Privacy */}
       <div className="space-y-3 pt-2 border-t">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Privacy</Label>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-base">🔒</span>
              <div>
                <Label className="cursor-pointer font-medium text-sm" htmlFor="include-start">
                  Include starting location in shared templates
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {(settings.includeStartingLocation ?? true) ? 'Starting location will appear in exported templates' : 'Origin will be hidden when you share or export this trip'}
                </p>
              </div>
            </div>
            <Switch
              id="include-start"
              checked={settings.includeStartingLocation ?? true}
              onCheckedChange={(checked) => handleChange('includeStartingLocation', checked)}
            />
          </div>
       </div>
    </div>
  );
}

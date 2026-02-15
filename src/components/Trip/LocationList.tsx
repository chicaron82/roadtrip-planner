import type { Location } from '../../types';
import { Button } from '../UI/Button';
import { LocationSearchInput } from './LocationSearchInput';
import { MapPin, Flag, Circle, X } from 'lucide-react';

interface LocationListProps {
  locations: Location[];
  setLocations: (locations: Location[]) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

export function LocationList({ locations, setLocations, onCalculate, isCalculating }: LocationListProps) {
  
  const updateLocation = (index: number, newLoc: Partial<Location>) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], ...newLoc };
    setLocations(updated);
  };

  const removeLocation = (index: number) => {
    const updated = locations.filter((_, i) => i !== index);
    setLocations(updated);
  };

  const addWaypoint = () => {
    const newLoc: Location = {
      id: crypto.randomUUID(),
      name: '',
      lat: 0,
      lng: 0,
       type: 'waypoint',
    };
    // Insert before the destination (last item)
    const updated = [...locations];
    updated.splice(updated.length - 1, 0, newLoc);
    setLocations(updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {locations.map((loc, index) => (
          <div key={loc.id} className="relative group">
            <div className="flex items-center gap-2 mb-1.5">
              {loc.type === 'origin' ? (
                <Circle className="h-4 w-4 text-green-500 fill-current" />
              ) : loc.type === 'destination' ? (
                <Flag className="h-4 w-4 text-red-500 fill-current" />
              ) : (
                <MapPin className="h-4 w-4 text-blue-500 fill-current" />
              )}
              
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {loc.type === 'origin' ? 'Starting Point' : loc.type === 'destination' ? 'Destination' : `Stop ${index}`}
              </span>

              {loc.type === 'waypoint' && (
                <button 
                  onClick={() => removeLocation(index)}
                  className="ml-auto text-xs text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
            </div>

            <LocationSearchInput
              value={loc.name}
              onSelect={(l) => updateLocation(index, l)}
              placeholder={loc.type === 'origin' ? "Where are you starting?" : loc.type === 'destination' ? "Where are you going?" : "Add a stop..."}
            />
            
            {index < locations.length - 1 && (
                 <div className="absolute left-[7px] top-[34px] bottom-[-14px] w-[2px] border-l-2 border-dashed border-primary/20 z-0 h-4" />
            )}
          </div>
        ))}
      </div>

       <Button variant="outline" size="sm" onClick={addWaypoint} className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/5">
        + Add Stop
      </Button>

      <Button 
        onClick={onCalculate} 
        disabled={isCalculating || locations.some(l => !l.name)}
        className="w-full h-12 text-sm font-semibold shadow-lg"
      >
        {isCalculating ? "Calculating..." : "🗺️ Calculate Route"}
      </Button>
    </div>
  );
}

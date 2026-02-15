import { useState } from 'react';
import type { Location } from '../../types';
import { Button } from '../UI/Button';
import { LocationSearchInput } from './LocationSearchInput';
import { MapPin, Flag, Circle, X, Star } from 'lucide-react';
import { getFavorites, toggleFavorite, type SavedLocation } from '../../lib/storage';

interface LocationListProps {
  locations: Location[];
  setLocations: (locations: Location[]) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

export function LocationList({ locations, setLocations, onCalculate, isCalculating }: LocationListProps) {
  const [favorites, setFavorites] = useState<SavedLocation[]>(() => getFavorites());

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

  const handleToggleFavorite = (loc: Location) => {
      if (!loc.name) return;
      const updated = toggleFavorite(loc);
      setFavorites(updated);
  };

  const isFavorite = (loc: Location) => {
      return favorites.some(f => f.name === loc.name); // Simple check
  };

  const loadFavorite = (index: number, fav: SavedLocation) => {
      const { ...locData } = fav;
      // Preserve the type (origin/destination/waypoint) of the slot we are filling
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { type, isFavorite, ...data } = locData;
      
      updateLocation(index, data);
  };

  return (
    <div className="space-y-4">
      {/* Favorites Quick Bar */}
      {favorites.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {favorites.map((fav, i) => (
                  <button
                    key={i}
                    onClick={() => {
                        // Logic to determine where to put it? 
                        // For now, let's just say if Origin is empty, put it there. Else put it in Dest?
                        // Actually, simpler: Drag and drop? No.
                        // Click to fill the *first empty slot*?
                        const emptyIndex = locations.findIndex(l => !l.name);
                        if (emptyIndex !== -1) {
                            loadFavorite(emptyIndex, fav);
                        } else {
                            // Append as waypoint if full?
                            // Or just alert?
                            // Let's just try to fill the 'Destination' if it's empty, or 'Origin'
                        }
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200 whitespace-nowrap hover:bg-yellow-100"
                    title="Click to fill first empty slot"
                  >
                      <Star className="h-3 w-3 fill-current" />
                      {fav.name.split(',')[0]}
                  </button>
              ))}
          </div>
      )}

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

              <div className="ml-auto flex items-center gap-1">
                  {loc.name && (
                      <button
                        onClick={() => handleToggleFavorite(loc)}
                        className={`text-xs transition-colors p-1 rounded hover:bg-muted ${isFavorite(loc) ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                        title={isFavorite(loc) ? "Remove from Favorites" : "Save to Favorites"}
                      >
                          <Star className={`h-3 w-3 ${isFavorite(loc) ? 'fill-current' : ''}`} />
                      </button>
                  )}
                  
                  {loc.type === 'waypoint' && (
                    <button 
                      onClick={() => removeLocation(index)}
                      className="text-xs text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
              </div>
            </div>

            <div className="flex gap-2">
                <div className="flex-1">
                    <LocationSearchInput
                      value={loc.name}
                      onSelect={(l) => updateLocation(index, l)}
                      placeholder={loc.type === 'origin' ? "Where are you starting?" : loc.type === 'destination' ? "Where are you going?" : "Add a stop..."}
                    />
                </div>
                 {/* Quick Load Button if empty? and favorites exist? */}
                 {!loc.name && favorites.length > 0 && (
                     <div className="relative group/fav">
                         <Button variant="ghost" size="icon" className="h-[38px] w-[38px] border border-dashed text-yellow-500/50 hover:text-yellow-600 hover:border-yellow-400">
                             <Star className="h-4 w-4" />
                         </Button>
                         {/* Simple Dropdown on hover/click could go here, but let's keep it simple for now */}
                          <div className="absolute right-0 top-full mt-1 w-48 bg-card border shadow-xl rounded-md p-1 z-50 hidden group-hover/fav:block">
                              <div className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-wider font-semibold">Load Favorite</div>
                              {favorites.map((fav, i) => (
                                  <button
                                    key={i}
                                    onClick={() => loadFavorite(index, fav)}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded flex items-center gap-2 truncate"
                                  >
                                      <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                                      <span className="truncate">{fav.name}</span>
                                  </button>
                              ))}
                          </div>
                     </div>
                 )}
            </div>
            
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

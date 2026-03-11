import { useState, useEffect, useRef } from 'react';
import type { Location } from '../../../types';
import { Button } from '../../UI/Button';
import { LocationSearchInput } from './LocationSearchInput';
import { MapPin, Flag, Circle, X, Star, GripVertical, Loader2 } from 'lucide-react';
import type { SavedLocation } from '../../../lib/storage';
import {
  DndContext,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLocationListController } from '../../../hooks/useLocationListController';

interface LocationListProps {
  locations: Location[];
  setLocations: (locations: Location[]) => void;
  onCalculate: () => void;
  isCalculating: boolean;
  hideCalculateButton?: boolean;
}

interface SortableLocationItemProps {
  location: Location;
  index: number;
  totalLocations: number;
  onUpdate: (index: number, newLoc: Partial<Location>) => void;
  onRemove: (index: number) => void;
  onToggleFavorite: (loc: Location) => void;
  isFavorite: (loc: Location) => boolean;
  favorites: SavedLocation[];
  loadFavorite: (index: number, fav: SavedLocation) => void;
}

function SortableLocationItem({
  location: loc,
  index,
  totalLocations,
  onUpdate,
  onRemove,
  onToggleFavorite,
  isFavorite,
  favorites,
  loadFavorite,
}: SortableLocationItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: loc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [favOpen, setFavOpen] = useState(false);
  const favRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!favOpen) return;
    const handler = (e: MouseEvent) => {
      if (favRef.current && !favRef.current.contains(e.target as Node)) setFavOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [favOpen]);

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          {...attributes}
          {...listeners}
          role="button"
          aria-label={loc.name ? `Drag to reorder ${loc.name}` : `Drag to reorder Stop ${index}`}
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground transition-colors"
        >
          <GripVertical className="h-4 w-4" />
        </div>

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
              onClick={() => onToggleFavorite(loc)}
              className={`text-xs transition-colors p-1 rounded hover:bg-muted ${isFavorite(loc) ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
              title={isFavorite(loc) ? 'Remove from Favorites' : 'Save to Favorites'}
            >
              <Star className={`h-3 w-3 ${isFavorite(loc) ? 'fill-current' : ''}`} />
            </button>
          )}
          {loc.type === 'waypoint' && (
            <button
              onClick={() => onRemove(index)}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1 p-1 rounded hover:bg-destructive/10"
              title="Remove stop"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 pl-6">
        <div className="flex-1">
          <LocationSearchInput
            value={loc.name}
            onSelect={(l) => onUpdate(index, l)}
            placeholder={loc.type === 'origin' ? 'Where are you starting?' : loc.type === 'destination' ? 'Where are you going?' : 'Add a stop...'}
          />
        </div>
        {!loc.name && favorites.length > 0 && (
          <div ref={favRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-[38px] w-[38px] border border-dashed text-yellow-500/50 hover:text-yellow-600 hover:border-yellow-400"
              onClick={() => setFavOpen(o => !o)}
              aria-label="Load favourite"
            >
              <Star className="h-4 w-4" />
            </Button>
            {favOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border shadow-xl rounded-md p-1 z-50">
                <div className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-wider font-semibold">Load Favourite</div>
                {favorites.map((fav, i) => (
                  <button
                    key={i}
                    onClick={() => { loadFavorite(index, fav); setFavOpen(false); }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded flex items-center gap-2 truncate"
                  >
                    <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />
                    <span className="truncate">{fav.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stop Intent — only for named waypoints */}
      {loc.type === 'waypoint' && loc.name && (
        <div className="pl-6 mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {([
              { key: 'fuel',      label: '⛽ Fuel',      title: 'Plan a fuel stop here' },
              { key: 'meal',      label: '🍽️ Meal',      title: 'Plan a meal break here' },
              { key: 'overnight', label: '🏨 Overnight', title: 'Pins overnight here — engine plans hotel at this stop' },
            ] as const).map(({ key, label, title }) => {
              const checked = loc.intent?.[key] ?? false;
              return (
                <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none" title={title}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onUpdate(index, { intent: { ...loc.intent, [key]: e.target.checked } })}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span className={checked ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
                </label>
              );
            })}
            {(loc.intent?.fuel || loc.intent?.meal) && (
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={loc.intent?.dwellMinutes ?? ((loc.intent?.fuel ? 15 : 0) + (loc.intent?.meal ? 45 : 0))}
                  onChange={(e) =>
                    onUpdate(index, { intent: { ...loc.intent, dwellMinutes: Math.max(5, Number(e.target.value)) } })
                  }
                  className="w-14 text-xs border rounded px-2 py-1 bg-background text-right"
                />
                <span className="text-[10px] text-muted-foreground">min</span>
              </div>
            )}
          </div>
          {loc.intent?.overnight && (
            <p className="text-[10px] text-blue-500/70">
              Night here — engine will plan your hotel in {loc.name.split(',')[0]}.
            </p>
          )}
        </div>
      )}

      {index < totalLocations - 1 && (
        <div className="absolute left-[23px] top-[34px] bottom-[-14px] w-[2px] border-l-2 border-dashed border-primary/20 z-0 h-4" />
      )}
    </div>
  );
}

export function LocationList({ locations, setLocations, onCalculate, isCalculating, hideCalculateButton }: LocationListProps) {
  const {
    favorites,
    isFavorite,
    handleToggleFavorite,
    loadFavorite,
    loadFavoriteIntoFirstEmpty,
    updateLocation,
    removeLocation,
    addWaypoint,
    sensors,
    collisionDetection,
    handleDragEnd,
  } = useLocationListController({ locations, setLocations });

  return (
    <div className="space-y-4">
      {/* Favorites Quick Bar */}
      {favorites.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-2 no-scrollbar touch-pan-x"
          data-no-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {favorites.map((fav, i) => (
            <button
              key={i}
              onClick={() => loadFavoriteIntoFirstEmpty(fav)}
              className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200 whitespace-nowrap hover:bg-yellow-100 dark:bg-yellow-500/10 dark:border-yellow-500/20 dark:text-yellow-500 hover:dark:bg-yellow-500/20"
              title="Click to fill first empty slot"
            >
              <Star className="h-3 w-3 fill-current" />
              {fav.name.split(',')[0]}
            </button>
          ))}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={locations.map((loc) => loc.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {locations.map((loc, index) => (
              <SortableLocationItem
                key={loc.id}
                location={loc}
                index={index}
                totalLocations={locations.length}
                onUpdate={updateLocation}
                onRemove={removeLocation}
                onToggleFavorite={handleToggleFavorite}
                isFavorite={isFavorite}
                favorites={favorites}
                loadFavorite={loadFavorite}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="outline" size="sm" onClick={addWaypoint} className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/5">
        + Add Stop
      </Button>

      {!hideCalculateButton && (
        <Button
          onClick={onCalculate}
          disabled={isCalculating || locations.some(l => !l.name)}
          className="w-full h-12 text-sm font-semibold shadow-lg"
        >
          {isCalculating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Calculating...</>
          ) : '🗺️ Calculate Route'}
        </Button>
      )}
    </div>
  );
}

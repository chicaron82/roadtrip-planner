/**
 * useLocationListController.ts — Location management logic for the LocationList.
 *
 * Extracts from LocationList:
 *  - favorites state (loaded from localStorage, kept in sync on toggle)
 *  - updateLocation, removeLocation, addWaypoint — setLocations operations
 *  - handleToggleFavorite, isFavorite, loadFavorite — favorites CRUD
 *  - handleDragEnd — DnD arrayMove + re-typing (origin/waypoint/destination)
 *  - DnD sensors configuration
 *
 * LocationList becomes a layout-only component: receives handlers and renders.
 *
 * 💚 My Experience Engine
 */

import { useState, useCallback } from 'react';
import type { Location } from '../types';
import { getFavorites, toggleFavorite, type SavedLocation } from '../lib/storage';
import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface UseLocationListControllerOptions {
  locations: Location[];
  setLocations: (locations: Location[]) => void;
}

export interface UseLocationListControllerReturn {
  // Favorites
  favorites: SavedLocation[];
  isFavorite: (loc: Location) => boolean;
  handleToggleFavorite: (loc: Location) => void;
  loadFavorite: (index: number, fav: SavedLocation) => void;
  loadFavoriteIntoFirstEmpty: (fav: SavedLocation) => void;
  // Location mutations
  updateLocation: (index: number, newLoc: Partial<Location>) => void;
  removeLocation: (index: number) => void;
  addWaypoint: () => void;
  // DnD
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: typeof closestCenter;
  handleDragEnd: (event: DragEndEvent) => void;
}

export function useLocationListController({
  locations,
  setLocations,
}: UseLocationListControllerOptions): UseLocationListControllerReturn {
  const [favorites, setFavorites] = useState<SavedLocation[]>(() => getFavorites());

  // ── DnD sensors ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Location mutations ───────────────────────────────────────────────────────
  const updateLocation = useCallback((index: number, newLoc: Partial<Location>) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], ...newLoc };
    setLocations(updated);
  }, [locations, setLocations]);

  const removeLocation = useCallback((index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  }, [locations, setLocations]);

  const addWaypoint = useCallback(() => {
    const newLoc: Location = {
      id: crypto.randomUUID(),
      name: '',
      lat: 0,
      lng: 0,
      type: 'waypoint',
    };
    // Insert before destination (last item)
    const updated = [...locations];
    updated.splice(updated.length - 1, 0, newLoc);
    setLocations(updated);
  }, [locations, setLocations]);

  // ── Favorites ───────────────────────────────────────────────────────────────
  const isFavorite = useCallback(
    (loc: Location) => favorites.some(f => f.name === loc.name),
    [favorites],
  );

  const handleToggleFavorite = useCallback((loc: Location) => {
    if (!loc.name) return;
    const updated = toggleFavorite(loc);
    setFavorites(updated);
  }, []);

  const loadFavorite = useCallback((index: number, fav: SavedLocation) => {
      const { type: _type, isFavorite: _isFav, ...data } = fav;
    updateLocation(index, data);
  }, [updateLocation]);

  const loadFavoriteIntoFirstEmpty = useCallback((fav: SavedLocation) => {
    const emptyIndex = locations.findIndex(l => !l.name);
    if (emptyIndex !== -1) loadFavorite(emptyIndex, fav);
  }, [locations, loadFavorite]);

  // ── DnD ─────────────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = locations.findIndex(loc => loc.id === active.id);
    const newIndex = locations.findIndex(loc => loc.id === over.id);

    const reordered = arrayMove(locations, oldIndex, newIndex);
    const reTyped = reordered.map((loc, i, arr) => ({
      ...loc,
      type: (i === 0 ? 'origin' : i === arr.length - 1 ? 'destination' : 'waypoint') as Location['type'],
    }));
    setLocations(reTyped);
  }, [locations, setLocations]);

  return {
    favorites,
    isFavorite,
    handleToggleFavorite,
    loadFavorite,
    loadFavoriteIntoFirstEmpty,
    updateLocation,
    removeLocation,
    addWaypoint,
    sensors,
    collisionDetection: closestCenter,
    handleDragEnd,
  };
}

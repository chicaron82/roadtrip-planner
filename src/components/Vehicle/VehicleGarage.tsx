/**
 * VehicleGarage — Save, load, delete, and set default vehicles.
 *
 * Extracted from VehicleForm to isolate garage persistence logic.
 * All storage I/O lives here; parent just receives the selected Vehicle.
 */

import { useState } from 'react';
import type { Vehicle } from '../../types';
import { Button } from '../UI/Button';
import { Select } from '../UI/Select';
import { Input } from '../UI/Input';
import { Label } from '../UI/Label';
import { Tooltip, TooltipContent, TooltipTrigger } from '../UI/Tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../UI/Dialog';
import { Car, Save, Star, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getGarage,
  saveToGarage,
  removeFromGarage,
  setDefaultVehicleId,
  type SavedVehicle,
} from '../../lib/storage';

// ==================== PROPS ====================

interface VehicleGarageProps {
  vehicle: Vehicle;
  onSelectVehicle: (vehicle: Vehicle, saved: SavedVehicle) => void;
}

// ==================== HELPERS ====================

function formatLastUsed(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ==================== COMPONENT ====================

export function VehicleGarage({ vehicle, onSelectVehicle }: VehicleGarageProps) {
  const [garage, setGarage] = useState<SavedVehicle[]>(() => getGarage());
  const [garageId, setGarageId] = useState('');

  // Dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState('');

  // Sort: default first, then by last used
  const sortedGarage = [...garage].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
    const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
    return bTime - aTime;
  });

  const handleGarageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setGarageId(id);
    const saved = garage.find(v => v.id === id);
    if (saved) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, name: _name, lastUsed: _lastUsed, isDefault: _isDefault, ...vehicleData } = saved;
      onSelectVehicle(vehicleData, saved);
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
        lastUsed: new Date().toISOString(),
      };
      const updatedGarage = saveToGarage(newSaved);
      setGarage(updatedGarage);
      setGarageId(newSaved.id);
      setSaveDialogOpen(false);
      setVehicleName('');
    }
  };

  const handleDeleteFromGarage = () => {
    if (garageId) setDeleteDialogOpen(true);
  };

  const confirmDeleteFromGarage = () => {
    if (garageId) {
      const updated = removeFromGarage(garageId);
      setGarage(updated);
      setGarageId('');
      setDeleteDialogOpen(false);
    }
  };

  const handleSetDefault = (id: string) => {
    setDefaultVehicleId(id);
    setGarage(getGarage());
  };

  const selectedIsDefault = garage.find(v => v.id === garageId)?.isDefault;

  return (
    <>
      <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-primary/20">
        <label className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1">
          <Car className="h-3 w-3" /> The Garage
        </label>
        <div className="flex gap-2">
          <Select value={garageId} onChange={handleGarageChange} className="flex-1 bg-background">
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
                      'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50',
                      selectedIsDefault && 'bg-yellow-100',
                    )}
                  >
                    <Star className={cn('h-4 w-4', selectedIsDefault && 'fill-current')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Set as default vehicle</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteFromGarage}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
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
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveToGarage(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSaveToGarage} disabled={!vehicleName.trim()}>Save</Button>
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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteFromGarage}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

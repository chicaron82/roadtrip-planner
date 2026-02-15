import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../UI/Dialog';
import { ItineraryTimeline } from './ItineraryTimeline';
import type { TripSummary, TripSettings } from '../../types';
import { X } from 'lucide-react';
import { Button } from '../UI/Button';

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
  summary: TripSummary;
  settings: TripSettings;
}

export function ItineraryModal({ open, onClose, summary, settings }: ItineraryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Complete Itinerary</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Detailed trip itinerary with gas stops, arrival times, and weather information
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <ItineraryTimeline summary={summary} settings={settings} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

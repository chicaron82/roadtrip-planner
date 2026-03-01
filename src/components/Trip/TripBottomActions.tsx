import { Share2, Printer } from 'lucide-react';
import { printTrip } from './TripPrintView';
import type { TripSummary, TripSettings, Vehicle } from '../../types';

interface Props {
  summary: TripSummary;
  settings: TripSettings;
  vehicle: Vehicle;
  shareUrl: string | null;
  onOpenGoogleMaps: () => void;
  onCopyShareLink: () => void;
}

export function TripBottomActions({ summary, settings, vehicle, shareUrl, onOpenGoogleMaps, onCopyShareLink }: Props) {
  return (
    <div
      className="flex items-center justify-center gap-2 pt-1 pb-0.5 flex-wrap"
      style={{ borderTop: '1px solid rgba(245,240,232,0.07)', paddingTop: '12px' }}
    >
      <button
        onClick={onOpenGoogleMaps}
        className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-all"
        style={{ background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.1)', color: 'rgba(245,240,232,0.45)' }}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        Google Maps
      </button>
      {shareUrl && (
        <button
          onClick={onCopyShareLink}
          className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-all"
          style={{ background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.1)', color: 'rgba(245,240,232,0.45)' }}
        >
          <Share2 className="h-3 w-3" />
          Share
        </button>
      )}
      <button
        onClick={() => printTrip({ summary, settings, vehicle })}
        className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-all"
        style={{ background: 'rgba(245,240,232,0.05)', border: '1px solid rgba(245,240,232,0.1)', color: 'rgba(245,240,232,0.45)' }}
      >
        <Printer className="h-3 w-3" />
        Print
      </button>
    </div>
  );
}

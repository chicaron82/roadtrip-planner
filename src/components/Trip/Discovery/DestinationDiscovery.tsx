import type { TripSummary, POISuggestion } from '../../../types';
import { DiscoveryPanel } from './DiscoveryPanel';

interface DestinationDiscoveryProps {
  summary: TripSummary;
  poiSuggestions?: POISuggestion[];
  isLoadingPOIs?: boolean;
  poiPartialResults?: boolean;
  poiFetchFailed?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
}

export function DestinationDiscovery({
  summary,
  poiSuggestions,
  isLoadingPOIs,
  poiPartialResults,
  poiFetchFailed,
  onAddPOI,
  onDismissPOI,
}: DestinationDiscoveryProps) {
  const segs = summary.segments;
  const originName = segs[0]?.from.name;
  const lastSegTo = segs[segs.length - 1]?.to.name;
  const isRoundTrip = !!(originName && lastSegTo && originName === lastSegTo);
  const roundTripMidpoint = summary.roundTripMidpoint;
  const destinationName = isRoundTrip
    ? segs[Math.ceil(segs.length / 2) - 1]?.to.name || 'Destination'
    : lastSegTo || 'Destination';

  const alongWaySuggestions = (poiSuggestions || []).filter(
    p => p.bucket === 'along-way'
  );
  const destinationSuggestions = (poiSuggestions || []).filter(
    p => p.bucket === 'destination' && p.category !== 'gas'
  );

  if (poiFetchFailed) {
    return (
      <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-2 text-sm text-amber-800">
        <span className="flex-shrink-0 mt-0.5">⚠️</span>
        <span>Couldn't load nearby suggestions — recalculate your route to try again.</span>
      </div>
    );
  }

  const nothingFound = !isLoadingPOIs && !alongWaySuggestions.length && !destinationSuggestions.length;
  if (nothingFound) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-center text-sm text-amber-700">
        <p className="font-medium">Nothing notable found nearby</p>
        <p className="text-xs mt-1 text-amber-600">Try different trip preferences or adjust your route.</p>
      </div>
    );
  }

  return (
    <>
      {(alongWaySuggestions.length > 0 || isLoadingPOIs) && (
        <DiscoveryPanel
          title="Cool Stops Along the Way"
          suggestions={alongWaySuggestions}
          isLoading={!!isLoadingPOIs}
          onAdd={onAddPOI}
          onDismiss={onDismissPOI}
          partialResults={poiPartialResults}
          roundTripMidpoint={roundTripMidpoint}
          className="mt-4"
        />
      )}
      {(destinationSuggestions.length > 0 || isLoadingPOIs) && (
        <DiscoveryPanel
          title={`Things to Do in ${destinationName}`}
          suggestions={destinationSuggestions}
          isLoading={!!isLoadingPOIs}
          onAdd={onAddPOI}
          onDismiss={onDismissPOI}
          partialResults={poiPartialResults}
          className="mt-4"
        />
      )}
    </>
  );
}

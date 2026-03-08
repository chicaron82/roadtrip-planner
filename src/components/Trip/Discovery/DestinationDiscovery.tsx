import type { TripSummary, POISuggestion } from '../../../types';
import { DiscoveryPanel } from './DiscoveryPanel';

interface DestinationDiscoveryProps {
  summary: TripSummary;
  poiSuggestions?: POISuggestion[];
  isLoadingPOIs?: boolean;
  poiPartialResults?: boolean;
  onAddPOI: (poiId: string, segmentIndex?: number) => void;
  onDismissPOI: (poiId: string) => void;
}

export function DestinationDiscovery({
  summary,
  poiSuggestions,
  isLoadingPOIs,
  poiPartialResults,
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

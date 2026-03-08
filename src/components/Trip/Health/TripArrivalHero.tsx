import { MapPin } from 'lucide-react';

interface ArrivalInfo {
  dest: string;
  time: string;
  isRoundTrip: boolean;
}

interface Props {
  arrivalInfo: ArrivalInfo;
}

export function TripArrivalHero({ arrivalInfo }: Props) {
  return (
    <div
      className="rounded-xl border px-5 py-5 text-center"
      style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.18)' }}
    >
      <MapPin className="h-4 w-4 text-green-400/60 mx-auto mb-2" />
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
        {arrivalInfo.isRoundTrip ? 'outbound · round trip' : 'destination'}
      </p>
      <p
        className="text-xl italic text-foreground/80 leading-snug"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        {arrivalInfo.isRoundTrip ? (
          <>
            You'll roll into{' '}
            <span className="not-italic font-bold text-green-400 text-2xl">{arrivalInfo.dest}</span>
            {' '}and be back by{' '}
            <span className="not-italic font-bold text-green-400 text-2xl">{arrivalInfo.time}</span>
          </>
        ) : (
          <>
            You'll roll into{' '}
            <span className="not-italic font-bold text-green-400 text-2xl">{arrivalInfo.dest}</span>
            {' '}at{' '}
            <span className="not-italic font-bold text-green-400 text-2xl">{arrivalInfo.time}</span>
          </>
        )}
      </p>
    </div>
  );
}

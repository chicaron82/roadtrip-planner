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
      className="rounded-xl border px-4 py-3 text-center"
      style={{ background: 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.18)' }}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">
        {arrivalInfo.isRoundTrip ? 'outbound · round trip' : 'destination'}
      </p>
      <p className="text-sm italic text-foreground/80 leading-snug">
        {arrivalInfo.isRoundTrip ? (
          <>
            You'll roll into{' '}
            <span className="not-italic font-bold text-green-400">{arrivalInfo.dest}</span>
            {' '}and be back by{' '}
            <span className="not-italic font-bold text-green-400">{arrivalInfo.time}</span>
          </>
        ) : (
          <>
            You'll roll into{' '}
            <span className="not-italic font-bold text-green-400">{arrivalInfo.dest}</span>
            {' '}at{' '}
            <span className="not-italic font-bold text-green-400">{arrivalInfo.time}</span>
          </>
        )}
      </p>
    </div>
  );
}

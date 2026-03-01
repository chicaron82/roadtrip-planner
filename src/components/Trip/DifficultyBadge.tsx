interface Difficulty {
  color: string;
  emoji: string;
  level: string;
}

interface Props {
  difficulty: Difficulty;
}

const PALETTE: Record<string, { border: string; text: string; bg: string }> = {
  green:  { border: 'rgba(34,197,94,0.35)',  text: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  yellow: { border: 'rgba(234,179,8,0.35)',  text: '#eab308', bg: 'rgba(234,179,8,0.1)'  },
  orange: { border: 'rgba(249,115,22,0.35)', text: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  red:    { border: 'rgba(239,68,68,0.35)',  text: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};

export function DifficultyBadge({ difficulty }: Props) {
  const dc = PALETTE[difficulty.color] ?? PALETTE.green;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ border: `1px solid ${dc.border}`, color: dc.text, background: dc.bg }}
    >
      {difficulty.emoji} {difficulty.level}
    </span>
  );
}

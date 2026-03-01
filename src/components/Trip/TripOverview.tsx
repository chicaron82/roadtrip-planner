import type { TripSummary, TripSettings } from '../../types';
import { generateTripOverview } from '../../lib/trip-analyzer';
import { Target, TrendingUp, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../UI/Tooltip';

interface TripOverviewProps {
  summary: TripSummary;
  settings: TripSettings;
}

const DIFFICULTY_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  green:  { bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.28)',   text: '#4ade80' },
  yellow: { bg: 'rgba(234,179,8,0.10)',   border: 'rgba(234,179,8,0.28)',   text: '#facc15' },
  orange: { bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.28)',  text: '#fb923c' },
  red:    { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.28)',   text: '#f87171' },
};
const CONFIDENCE_PALETTE = { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.28)', text: '#60a5fa' };

export function TripOverview({ summary, settings }: TripOverviewProps) {
  const { difficulty, confidence, highlights } = generateTripOverview(summary, settings);
  const dp = DIFFICULTY_PALETTE[difficulty.color] ?? DIFFICULTY_PALETTE.green;

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Difficulty Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="p-3 rounded-lg border-2 cursor-help transition-all hover:brightness-110"
              style={{ background: dp.bg, borderColor: dp.border, color: dp.text }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Difficulty</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{difficulty.emoji}</span>
                <div>
                  <div className="font-bold text-lg capitalize" style={{ color: 'rgba(245,240,232,0.88)' }}>{difficulty.level}</div>
                  <div className="text-xs opacity-60">{difficulty.score}/100</div>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold text-xs">Difficulty Factors:</div>
              {difficulty.factors.map((factor, idx) => (
                <div key={idx} className="text-xs flex items-start gap-1">
                  <span>•</span>
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Route Confidence */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="p-3 rounded-lg border-2 cursor-help transition-all hover:brightness-110"
              style={{ background: CONFIDENCE_PALETTE.bg, borderColor: CONFIDENCE_PALETTE.border, color: CONFIDENCE_PALETTE.text }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Confidence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-bold text-lg" style={{ color: 'rgba(245,240,232,0.88)' }}>{confidence.label}</div>
                  <div className="text-xs opacity-60">{confidence.score}% accurate</div>
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold text-xs">Confidence Factors:</div>
              {confidence.factors.length > 0 ? (
                confidence.factors.map((factor, idx) => (
                  <div key={idx} className="text-xs flex items-start gap-1">
                    <span>•</span>
                    <span>{factor}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs">Based on routing data quality and trip complexity</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {highlights.map((highlight, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ background: 'rgba(245,240,232,0.06)', borderColor: 'rgba(245,240,232,0.12)', color: 'rgba(245,240,232,0.55)' }}
            >
              <AlertCircle className="h-3 w-3" />
              {highlight}
            </div>
          ))}
        </div>
      )}
    </TooltipProvider>
  );
}

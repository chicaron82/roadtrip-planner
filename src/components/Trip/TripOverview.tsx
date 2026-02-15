import type { TripSummary, TripSettings } from '../../types';
import { generateTripOverview } from '../../lib/trip-analyzer';
import { Target, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../UI/Tooltip';

interface TripOverviewProps {
  summary: TripSummary;
  settings: TripSettings;
}

export function TripOverview({ summary, settings }: TripOverviewProps) {
  const { difficulty, confidence, highlights } = generateTripOverview(summary, settings);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Difficulty Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "p-3 rounded-lg border-2 cursor-help transition-all hover:shadow-md",
                difficulty.color === 'green' && "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800",
                difficulty.color === 'yellow' && "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800",
                difficulty.color === 'orange' && "border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800",
                difficulty.color === 'red' && "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Difficulty</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{difficulty.emoji}</span>
                <div>
                  <div className="font-bold text-lg capitalize">{difficulty.level}</div>
                  <div className="text-xs opacity-70">{difficulty.score}/100</div>
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
            <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 cursor-help transition-all hover:shadow-md">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Confidence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-bold text-lg">{confidence.label}</div>
                  <div className="text-xs opacity-70">{confidence.score}% accurate</div>
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium border"
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

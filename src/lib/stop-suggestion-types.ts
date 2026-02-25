/**
 * stop-suggestion-types.ts — Shared types for the stop suggestion system
 *
 * Extracted from stop-suggestions.ts so consumers (components, hooks)
 * can import the shapes without pulling in the simulation engine.
 *
 * 💚 My Experience Engine
 */

export type SuggestionStopType = 'fuel' | 'rest' | 'meal' | 'overnight';

export interface SuggestedStop {
  id: string;
  type: SuggestionStopType;
  reason: string;
  afterSegmentIndex: number; // Insert after this segment
  estimatedTime: Date;
  duration: number; // minutes
  priority: 'required' | 'recommended' | 'optional';
  details: {
    fuelNeeded?: number; // litres to fill to full from current level
    fuelCost?: number;   // estimated cost at current gas price
    /** 'full' = tank was critically/range-low (fill to 100%).
     *  'topup' = comfort/precautionary stop (topped from ~25-50% to full). */
    fillType?: 'full' | 'topup';
    hoursOnRoad?: number; // hours driven before this stop
  };
  warning?: string; // Sparse stretch warning
  dayNumber?: number; // Which numeric day of the trip this occurs on
  dismissed?: boolean;
  accepted?: boolean;
}

export type StopFrequency = 'conservative' | 'balanced' | 'aggressive';

export interface StopSuggestionConfig {
  tankSizeLitres: number;
  fuelEconomyL100km: number;
  maxDriveHoursPerDay: number;
  numDrivers: number;
  departureTime: Date;
  gasPrice: number;
  stopFrequency?: StopFrequency; // How often to suggest stops (default 'balanced')
  fullGeometry?: number[][];     // Route polyline for hub-aware stop placement
}

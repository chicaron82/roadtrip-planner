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
    /** true when fuel stop doubles as a meal (stopped during lunch/dinner window) */
    comboMeal?: boolean;
    /** 'lunch' | 'dinner' when comboMeal = true — used for labeling the stop card */
    comboMealType?: 'lunch' | 'dinner';
    /** Tank fill level at the time of this stop (0–100). Used by the FuelGauge component. */
    tankPercent?: number;
  };
  /** Hub city name resolved at generation time (e.g. "Fargo, ND").
   *  When set, buildTimedTimeline uses this as the locationHint instead of
   *  the generic "~420 km from Winnipeg" distance marker. */
  hubName?: string;
  warning?: string; // Sparse stretch warning
  dayNumber?: number; // Which numeric day of the trip this occurs on
  dismissed?: boolean;
  accepted?: boolean;
  /** Geographic coordinates of the stop — populated at generation time for fuel stops.
   *  Used to project simulation fuel stops onto the map, replacing the separate
   *  calculateStrategicFuelStops geometry-based system with a single source of truth. */
  lat?: number;
  lng?: number;
  /** Cumulative km from route origin to this stop — for map pin lat/lng interpolation. */
  distanceFromStart?: number;
}

export type StopFrequency = 'conservative' | 'balanced' | 'aggressive';

export interface StopSuggestionConfig {
  tankSizeLitres: number;
  fuelEconomyL100km: number;
  isEV?: boolean;
  rangeKm?: number;
  chargerNetwork?: 'tesla' | 'ccs' | 'chademo';
  maxDriveHoursPerDay: number;
  numDrivers: number;
  departureTime: Date;
  gasPrice: number;
  stopFrequency?: StopFrequency; // How often to suggest stops (default 'balanced')
  fullGeometry?: number[][];     // Route polyline for hub-aware stop placement
}

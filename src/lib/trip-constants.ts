/**
 * Central home for every magic number in the trip planning pipeline.
 * Tune here instead of grep-hunting across 5 files.
 */
export const TRIP_CONSTANTS = {

  /** Departure time computation */
  departure: {
    /** Earliest allowed departure hour (24h). */
    minHour: 5,
    /** Max departure hour for a "full day" leg (≥75% of maxDriveHours). */
    maxHourFullDay: 10,
    /** Max departure hour for a short leg (<75% of maxDriveHours). */
    maxHourShortLeg: 18,
    /** Ratio of maxDriveHours above which a day is considered "full". */
    fullDayThreshold: 0.75,
  },

  /** Rest enforcement between driving days */
  rest: {
    /** Minimum hours of sleep guaranteed between estimated arrival and next departure. */
    minHours: 7,
  },

  /** Feasibility analysis thresholds */
  feasibility: {
    /** Grace buffer (hours) before a "hard limit exceeded" warning fires. */
    driveTimeGraceHours: 1,
    /** Fraction of max drive time that triggers an amber (tight) warning. */
    tightDriveThreshold: 0.90,
    /** Hours past targetArrivalHour before Day-1 late-arrival hint fires. */
    day1ArrivalBuffer: 0.5,
    /** Minimum number of drivers before per-driver shift hints appear. */
    minDriversForRotation: 2,
    /** Minimum driving minutes per day to show per-driver breakdown. */
    minDrivingMinutesForBreakdown: 120,
  },

  /** Day overflow: tolerance for slightly exceeding maxDriveHours in day splitting.
   *  Humans "push through 30 more minutes" to reach the next city rather than
   *  stopping at a highway km marker. Without this, an 8h30m day (510 min) gets
   *  split into two 4h15m days, doubling the trip length. */
  dayOverflow: {
    /** Base hours of grace beyond maxDriveHours before forcing a new day. */
    toleranceHours: 1,
    /** Extra minutes when 2+ drivers share the load (swap reduces fatigue). */
    multiDriverBonusMinutes: 30,
    /** Extra minutes on the last leg to avoid an unnecessary overnight. */
    lastLegBonusMinutes: 30,
    /** Minutes lost after fatigueDayThreshold consecutive driving days. */
    fatiguePenaltyMinutes: 15,
    /** Consecutive driving days before fatigue penalty kicks in. */
    fatigueDayThreshold: 3,
    /** Hard cap on total tolerance — prevents double-stacking from creating unreasonable days. */
    maxToleranceMinutes: 90,
  },

  /** Budget analysis thresholds */
  budget: {
    /** Utilization fraction that triggers an amber (tight) warning. */
    tightThreshold: 0.85,
    /** Utilization fraction that triggers a red (over-budget) warning. */
    overThreshold: 1.0,
  },

  /**
   * OSRM routing corrections
   *
   * The public OSRM demo server uses conservative speed profiles that
   * produce LONGER driving times than typical real-world travel — roughly
   * 15% slower than Google Maps or what most drivers actually experience.
   *
   * Multiply raw OSRM durations by this factor (0.85) to bring them in
   * line with real-world expectations.
   *
   * Example: OSRM says Winnipeg → Regina = 6h56m.
   *          × 0.85 = 5h54m, close to Google Maps' ~5h50m.
   *
   * Calibrated against Google Maps for Canadian prairie / Trans-Canada
   * routes. May need regional adjustment for mountainous or urban routes.
   */
  routing: {
    osrmDurationFactor: 0.85,
  },

  /**
   * Stop suggestion and consolidation parameters
   *
   * These thresholds govern when fuel/meal/rest stops are placed along the route.
   * They are tuned for trust, not precision — users won't follow the exact schedule,
   * but the suggestions should feel plausible and road-trip-savvy.
   */
  stops: {
    /** Time window (ms) within which nearby stops are merged. */
    mergeWindowMs: 60 * 60 * 1000,

    /** Overnight should only absorb an adjacent stop when they are effectively the same event. */
    overnightMergeWindowMs: 15 * 60 * 1000,

    /** Gentle heads-up threshold for a very long uninterrupted driving block. */
    longPushHours: 6,

    /** Priority tiers used when two stops compete for the same slot. Higher wins. */
    priorities: {
      overnight: 4,
      fuel: 3,
      meal: 2,
      rest: 1,
    } as const,

    /**
     * Safety margin subtracted from vehicle range before computing fuel stops.
     * safeRangeKm = vehicleRangeKm × (1 − buffer)
     *
     * Reflects realistic human behaviour: nobody drives to 75-80% of their
     * tank range between fills. Most people top up around the half-tank mark.
     *   conservative → stop at ~50% of range (tank at ~50%)
     *   balanced     → stop at ~60% of range (tank at ~40%)
     *   aggressive   → stop at ~65% of range (tank at ~35%)
     */
    buffers: {
      conservative: 0.50,
      balanced: 0.40,
      aggressive: 0.35,
    } as const,

    /** How many hours between mandatory rest breaks (by driving style). */
    restInterval: {
      conservative: 1.5,
      balanced: 2.0,
      aggressive: 2.5,
    } as const,

    /** How many hours between comfort refuel stops (by driving style). */
    comfortRefuel: {
      conservative: 2.5,
      balanced: 3.5,
      aggressive: 4.5,
    } as const,
  },

  /**
   * Fuel tank level thresholds (fraction of tankSizeLitres).
   * Used by the stop simulation engine to decide when to suggest refuelling.
   *
   *   critical — Tank is dangerously low. Always trigger a stop, even near destination.
   *   low      — Tank is getting low. Trigger a comfort stop before options get sparse.
   *   full     — Tank is essentially full. Suppress unnecessary "refuel now" suggestions.
   */
  fuelLevels: {
    critical: 0.15,
    low: 0.35,
    full: 0.98,
  },

} as const;

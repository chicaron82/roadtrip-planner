/** Mutable simulation state threaded through per-segment check functions */
export interface SimState {
  currentFuel: number;
  distanceSinceLastFill: number;
  hoursSinceLastFill: number;
  /** Accumulated segment.fuelCost since the last fill. Uses regional prices (same source as
   *  the budget model), so stop card "~$X to fill" matches the per-day gasUsed total. */
  costSinceLastFill: number;
  currentTime: Date;
  hoursOnRoad: number;
  totalDrivingToday: number;
  lastBreakTime: Date;
  currentDayNumber: number;
  currentTzAbbr: string | null;
  // Computed from stopFrequency config — constant throughout simulation
  restBreakInterval: number;
  comfortRefuelHours: number;
}

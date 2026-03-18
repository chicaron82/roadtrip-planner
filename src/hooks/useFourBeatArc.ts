/**
 * useFourBeatArc — State machine for the Four-Beat Arc icebreaker flow.
 *
 * Tell MEE → Sketch → Personal → Voilà
 *
 * Beat 1 is the existing icebreaker (PlanIcebreaker). This hook activates at
 * Beat 2 when the icebreaker completes, and drives Beats 2→3→4 before handing
 * off to the wizard at Step 3.
 *
 * The hook owns transition state only — rendering and calculation triggering
 * are the caller's responsibility.
 */
import { useState, useCallback, useMemo } from 'react';
import type { Location, Vehicle, TripSettings, TripSummary } from '../types';
import type { TripEstimate } from '../lib/estimate-service';
import { generateEstimate } from '../lib/estimate-service';
import { haversineDistance } from '../lib/poi-ranking';

export type Beat = 2 | 3 | 4 | null;

/** Road factor applied to haversine distance for sketch estimates. */
const ROAD_FACTOR = 1.25;

/** Average highway speed (km/h) for rough duration estimate. */
const AVG_HIGHWAY_SPEED_KMH = 90;

export interface SketchData {
  distanceKm: number;
  days: number;
  estimate: TripEstimate;
  originName: string;
  destinationName: string;
}

export interface FourBeatArcState {
  beat: Beat;
  isBuilding: boolean;
  isRevealing: boolean;
  sketchData: SketchData | null;

  /** Enter Beat 2 with icebreaker data. Computes haversine sketch estimate. */
  enterSketch: (locations: Location[], vehicle: Vehicle, settings: TripSettings) => void;
  /** Advance from Beat 2 → Beat 3 (workshop). */
  enterWorkshop: () => void;
  /** Fire calculation from Beat 2 (skip workshop) or Beat 3 (commit workshop). */
  startCalculation: () => void;
  /** Called when orchestrateTrip completes — transition to voilà. */
  onBuildComplete: () => void;
  /** Called when voilà hold completes — exit the arc. */
  onRevealComplete: () => void;
  /** Escape to classic wizard at any beat. */
  exitArc: () => void;
}

/**
 * Build a minimal TripSummary from haversine data — just enough for generateEstimate().
 */
function buildSketchSummary(distanceKm: number, durationMinutes: number): TripSummary {
  return {
    totalDistanceKm: distanceKm,
    totalDurationMinutes: durationMinutes,
    totalFuelLitres: 0,
    totalFuelCost: 0,
    gasStops: 0,
    costPerPerson: 0,
    drivingDays: Math.max(1, Math.ceil(durationMinutes / (8 * 60))),
    segments: [],
    fullGeometry: [],
  };
}

export function useFourBeatArc(): FourBeatArcState {
  const [beat, setBeat] = useState<Beat>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [sketchData, setSketchData] = useState<SketchData | null>(null);

  const enterSketch = useCallback((
    locations: Location[],
    vehicle: Vehicle,
    settings: TripSettings,
  ) => {
    const origin = locations.find(l => l.type === 'origin');
    const destination = locations.find(l => l.type === 'destination');
    if (!origin?.lat || !destination?.lat) return;

    // Haversine × road factor for approximate driving distance
    const straightLine = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const distanceKm = Math.round(straightLine * ROAD_FACTOR);
    const durationMinutes = Math.round((distanceKm / AVG_HIGHWAY_SPEED_KMH) * 60);

    const sketchSummary = buildSketchSummary(distanceKm, durationMinutes);
    const estimate = generateEstimate(sketchSummary, vehicle, settings);

    setSketchData({
      distanceKm,
      days: estimate.days,
      estimate,
      originName: origin.name || 'Origin',
      destinationName: destination.name || 'Destination',
    });

    setBeat(2);
  }, []);

  const enterWorkshop = useCallback(() => {
    setBeat(3);
  }, []);

  const startCalculation = useCallback(() => {
    setBeat(4);
    setIsBuilding(true);
  }, []);

  const onBuildComplete = useCallback(() => {
    setIsBuilding(false);
    setIsRevealing(true);
  }, []);

  const onRevealComplete = useCallback(() => {
    setIsRevealing(false);
    setBeat(null);
  }, []);

  const exitArc = useCallback(() => {
    setBeat(null);
    setIsBuilding(false);
    setIsRevealing(false);
    setSketchData(null);
  }, []);

  return useMemo(() => ({
    beat,
    isBuilding,
    isRevealing,
    sketchData,
    enterSketch,
    enterWorkshop,
    startCalculation,
    onBuildComplete,
    onRevealComplete,
    exitArc,
  }), [beat, isBuilding, isRevealing, sketchData, enterSketch, enterWorkshop, startCalculation, onBuildComplete, onRevealComplete, exitArc]);
}

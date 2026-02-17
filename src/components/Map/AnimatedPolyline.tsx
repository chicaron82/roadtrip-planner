import { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';

interface AnimatedPolylineProps {
  positions: [number, number][];
  color: string;
  weight: number;
  opacity: number;
  animationDuration?: number; // in milliseconds
}

export function AnimatedPolyline({
  positions,
  color,
  weight,
  opacity,
  animationDuration = 2000
}: AnimatedPolylineProps) {
  const [visiblePositions, setVisiblePositions] = useState<[number, number][]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Filter out invalid positions (undefined, null, or invalid coordinates)
    const validPositions = positions.filter(
      pos => pos && Array.isArray(pos) && pos.length === 2 &&
      typeof pos[0] === 'number' && typeof pos[1] === 'number' &&
      !isNaN(pos[0]) && !isNaN(pos[1]) &&
      pos[0] !== 0 && pos[1] !== 0 // Also filter out [0,0] coordinates
    );

    // Reset and start animation when positions change
    setVisiblePositions([]);
    setIsAnimating(true);

    const totalPoints = validPositions.length;
    if (totalPoints === 0) {
      setIsAnimating(false);
      return;
    }

    // For large routes, add points in batches instead of one-by-one
    // This keeps the animation fast regardless of route length
    const targetFrames = Math.min(totalPoints, 60); // cap at ~60 visual steps
    const batchSize = Math.max(1, Math.ceil(totalPoints / targetFrames));
    const intervalDuration = animationDuration / targetFrames;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < totalPoints) {
        const endIndex = Math.min(currentIndex + batchSize, totalPoints);
        const batch = validPositions.slice(currentIndex, endIndex).filter(
          pos => pos && Array.isArray(pos) && pos.length === 2
        );
        if (batch.length > 0) {
          setVisiblePositions(prev => [...prev, ...batch]);
        }
        currentIndex = endIndex;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, intervalDuration);

    return () => {
      clearInterval(interval);
      setIsAnimating(false);
    };
  }, [positions, animationDuration]);

  if (visiblePositions.length < 2) {
    return null;
  }

  return (
    <Polyline
      positions={visiblePositions}
      pathOptions={{
        color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
        className: isAnimating ? 'route-drawing' : ''
      }}
    />
  );
}

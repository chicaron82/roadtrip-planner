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

    // Animate the polyline drawing
    const totalPoints = validPositions.length;
    if (totalPoints === 0) {
      setIsAnimating(false);
      return;
    }

    const intervalDuration = animationDuration / totalPoints;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < totalPoints && validPositions[currentIndex]) {
        // Double-check the position is still valid before adding
        const nextPos = validPositions[currentIndex];
        if (nextPos && Array.isArray(nextPos) && nextPos.length === 2) {
          setVisiblePositions(prev => [...prev, nextPos]);
        }
        currentIndex++;
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

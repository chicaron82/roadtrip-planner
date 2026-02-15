import { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';

interface AnimatedPolylineProps {
  positions: [number, number][];
  color: string;
  weight: number;
  opacity: number;
  animationDuration?: number; // in milliseconds
  isShadow?: boolean;
}

export function AnimatedPolyline({
  positions,
  color,
  weight,
  opacity,
  animationDuration = 2000,
  isShadow = false
}: AnimatedPolylineProps) {
  const [visiblePositions, setVisiblePositions] = useState<[number, number][]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Reset and start animation when positions change
    setVisiblePositions([]);
    setIsAnimating(true);

    // Animate the polyline drawing
    const totalPoints = positions.length;
    if (totalPoints === 0) return;

    const intervalDuration = animationDuration / totalPoints;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < totalPoints) {
        setVisiblePositions(prev => [...prev, positions[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, intervalDuration);

    return () => clearInterval(interval);
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

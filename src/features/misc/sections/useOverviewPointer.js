import { useCallback, useEffect, useRef } from 'react';

export function captureScrollOrigins(node) {
  const origins = [];
  for (let current = node; current; current = current.parentElement)
    origins.push({ node: current, left: current.scrollLeft, top: current.scrollTop });
  return origins;
}

// Frozen rectangles use the viewport at drag start. Translate the real pointer
// into that coordinate space when a scrolling ancestor moves during the drag.
export function adjustedPointer({ point, origins }) {
  return origins.reduce(
    (value, origin) => ({
      x: value.x + origin.node.scrollLeft - origin.left,
      y: value.y + origin.node.scrollTop - origin.top,
    }),
    point,
  );
}

export default function useOverviewPointer() {
  const gesture = useRef(null);
  useEffect(() => {
    const track = (event) => {
      if (!gesture.current || event.pointerId !== gesture.current.pointerId) return;
      gesture.current.point = { x: event.clientX, y: event.clientY };
    };
    // Capture pointerup before the drag sensor ends the gesture. A quick mouse
    // release can arrive before React has rendered the final pointermove.
    document.addEventListener('pointermove', track, true);
    document.addEventListener('pointerup', track, true);
    return () => {
      document.removeEventListener('pointermove', track, true);
      document.removeEventListener('pointerup', track, true);
    };
  }, []);
  const start = useCallback((event, node) => {
    gesture.current = {
      pointerId: event.pointerId,
      point: { x: event.clientX, y: event.clientY },
      origins: captureScrollOrigins(node),
    };
  }, []);
  const read = useCallback(() => gesture.current && adjustedPointer(gesture.current), []);
  const stop = useCallback(() => {
    gesture.current = null;
  }, []);
  return { start, read, stop };
}

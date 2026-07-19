import { useState, useCallback } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Measures a chart container's width so SVGs can render responsively to the
 * card they sit in, rather than a hardcoded pixel width.
 */
export function useChartWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);
  return { width, onLayout };
}

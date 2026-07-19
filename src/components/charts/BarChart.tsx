import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

import { useChartWidth } from './useChartWidth';

type BarChartProps = {
  data: number[];
  height?: number;
  color?: string;
  /** Emphasise the most recent bar; earlier bars render at reduced opacity. */
  highlightLast?: boolean;
  /** Gap between bars as a fraction of the slot width (0–1). */
  gap?: number;
};

/**
 * Rounded vertical bars with a soft top-to-bottom gradient. Fills the parent's
 * width; heights scale to the largest value.
 */
export function BarChart({
  data,
  height = 96,
  color = colors.metric.water,
  highlightLast = false,
  gap = 0.32,
}: BarChartProps) {
  const gradientId = `bar-${useId().replace(/:/g, '')}`;
  const { width, onLayout } = useChartWidth();

  const max = Math.max(...data, 1);
  const slot = data.length > 0 ? width / data.length : 0;
  const barWidth = slot * (1 - gap);
  const minBar = 3;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={1} />
              <Stop offset="1" stopColor={color} stopOpacity={0.55} />
            </LinearGradient>
          </Defs>
          {data.map((value, index) => {
            const barHeight = Math.max((value / max) * (height - 4), minBar);
            const x = index * slot + (slot - barWidth) / 2;
            const y = height - barHeight;
            const dim = highlightLast && index !== data.length - 1;
            return (
              <Rect
                key={index}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2.5}
                fill={`url(#${gradientId})`}
                opacity={dim ? 0.4 : 1}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

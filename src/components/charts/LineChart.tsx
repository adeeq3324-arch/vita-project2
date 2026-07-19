import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, typography } from '@/theme';

import { useChartWidth } from './useChartWidth';

type LineChartProps = {
  data: number[];
  /** x-axis labels, spread evenly under the plot. */
  labels?: string[];
  height?: number;
  color?: string;
  /** Force the y-range; defaults to the data's min/max with padding. */
  min?: number;
  max?: number;
};

/**
 * Area line chart: a gradient fill under a smooth-ish polyline with a dot on
 * every point and optional x-axis labels. Responsive to the parent width.
 */
export function LineChart({ data, labels, height = 140, color = colors.primary, min, max }: LineChartProps) {
  const gradientId = `line-${useId().replace(/:/g, '')}`;
  const { width, onLayout } = useChartWidth();

  const labelHeight = labels ? 18 : 0;
  const plotHeight = height - labelHeight;
  const padY = 10;
  const padX = 4;

  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;

  const points = data.map((value, index) => {
    const x = padX + (data.length <= 1 ? 0 : (index / (data.length - 1)) * (width - padX * 2));
    const y = padY + (1 - (value - lo) / span) * (plotHeight - padY * 2);
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${line} L ${last.x} ${plotHeight} L ${first.x} ${plotHeight} Z` : '';

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && points.length > 1 ? (
        <>
          <Svg width={width} height={plotHeight}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* Faint horizontal guides at top and mid. */}
            <Line x1={0} y1={padY} x2={width} y2={padY} stroke={colors.divider} strokeWidth={1} />
            <Line
              x1={0}
              y1={plotHeight / 2}
              x2={width}
              y2={plotHeight / 2}
              stroke={colors.divider}
              strokeWidth={1}
            />
            <Path d={area} fill={`url(#${gradientId})`} />
            <Path
              d={line}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === points.length - 1 ? 4 : 3}
                fill={i === points.length - 1 ? color : colors.surface}
                stroke={color}
                strokeWidth={2}
              />
            ))}
          </Svg>
          {labels ? (
            <View style={[styles.labels, { height: labelHeight }]}>
              {labels.map((label, i) => (
                <Text key={i} style={styles.label}>
                  {label}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  label: {
    ...typography.micro,
    color: colors.text.disabled,
  },
});

import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { useChartWidth } from '@/components/charts/useChartWidth';
import { colors, fontWeight, radius, typography } from '@/theme';

type HealthTrendChartProps = {
  data: number[];
  labels: string[];
  height?: number;
  min?: number;
  max?: number;
  color?: string;
};

/** Y-axis ticks, top → bottom, matching the design. */
const TICKS = [100, 75, 50, 25, 0];
/** Width reserved for the y-axis tick labels. */
const AXIS_WIDTH = 22;

/**
 * Health Score trend: a violet line over dotted gridlines with a labelled
 * y-axis (100 → 0), weekday labels, and a small value tag pinned to the latest
 * point — the chart on the right of the Health Score card.
 */
export function HealthTrendChart({
  data,
  labels,
  height = 120,
  min = 0,
  max = 100,
  color = colors.primary,
}: HealthTrendChartProps) {
  const gradientId = `trend-${useId().replace(/:/g, '')}`;
  const { width, onLayout } = useChartWidth();

  const labelHeight = 16;
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const plotHeight = height - labelHeight;
  const padY = 12;
  const padX = 6;

  const span = max - min || 1;
  const yFor = (value: number) =>
    padY + (1 - (value - min) / span) * (plotHeight - padY * 2);
  const xFor = (index: number) =>
    padX + (data.length <= 1 ? 0 : (index / (data.length - 1)) * (plotWidth - padX * 2));

  const points = data.map((value, index) => ({ x: xFor(index), y: yFor(value) }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first && last ? `${line} L ${last.x} ${plotHeight - padY} L ${first.x} ${plotHeight - padY} Z` : '';

  const ready = width > 0 && points.length > 1;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {ready ? (
        <>
          <View style={styles.plotRow}>
            {/* Y-axis tick labels, aligned to their gridlines. */}
            <View style={[styles.axis, { height: plotHeight }]}>
              {TICKS.map((tick) => (
                <Text key={tick} style={[styles.axisLabel, { top: yFor(tick) - 5 }]}>
                  {tick}
                </Text>
              ))}
            </View>

            <Svg width={plotWidth} height={plotHeight}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={color} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {/* Dotted horizontal gridlines at each tick. */}
              {TICKS.map((tick) => (
                <Line
                  key={tick}
                  x1={0}
                  y1={yFor(tick)}
                  x2={plotWidth}
                  y2={yFor(tick)}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
              ))}

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

            {/* Value tag pinned above the latest point. */}
            {last ? (
              <View
                style={[
                  styles.tag,
                  { left: AXIS_WIDTH + last.x, top: Math.max(0, last.y - 26) },
                ]}
              >
                <Text style={styles.tagText}>{data[data.length - 1]}</Text>
              </View>
            ) : null}
          </View>

          {/* Weekday labels under the plot, aligned with the plot area. */}
          <View style={[styles.labels, { height: labelHeight, marginLeft: AXIS_WIDTH }]}>
            {labels.map((label, i) => (
              <Text key={i} style={styles.label}>
                {label}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plotRow: {
    flexDirection: 'row',
  },
  axis: {
    width: AXIS_WIDTH,
    paddingRight: 4,
  },
  axisLabel: {
    ...typography.micro,
    position: 'absolute',
    right: 4,
    fontSize: 9,
    lineHeight: 10,
    color: colors.text.disabled,
  },
  tag: {
    position: 'absolute',
    transform: [{ translateX: -12 }],
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
  },
  tagText: {
    ...typography.micro,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  label: {
    ...typography.micro,
    fontSize: 9,
    color: colors.text.disabled,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fontWeight, typography } from '@/theme';

export type DonutSegment = {
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  /** Large centred label, e.g. total. */
  centerLabel?: string;
  centerSub?: string;
};

/**
 * Ring chart made of proportional arcs — the Macros Distribution donut. Each
 * segment is a dash-offset arc; a value can sit in the hole.
 */
export function DonutChart({
  segments,
  size = 116,
  strokeWidth = 16,
  centerLabel,
  centerSub,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  // Each arc starts where the previous one ended, so the geometry is resolved
  // up front in a plain loop. Accumulating inside the JSX `map` below would
  // make the rendered output depend on the order the callbacks happen to run.
  const arcs: { dash: number; rotation: number; color: string }[] = [];
  let startFraction = 0;
  for (const segment of segments) {
    const fraction = segment.value / total;
    // Small gap between segments for definition.
    const gap = 2;
    arcs.push({
      dash: Math.max(fraction * circumference - gap, 0),
      rotation: startFraction * 360 - 90,
      color: segment.color,
    });
    startFraction += fraction;
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceSunken}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcs.map((arc, index) => (
          <Circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${arc.dash} ${circumference}`}
            rotation={arc.rotation}
            origin={`${size / 2}, ${size / 2}`}
          />
        ))}
      </Svg>
      {centerLabel ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerLabel}>{centerLabel}</Text>
          {centerSub ? <Text style={styles.centerSub}>{centerSub}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: fontWeight.bold,
  },
  centerSub: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});

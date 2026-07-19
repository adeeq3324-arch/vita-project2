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

  let startFraction = 0;

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
        {segments.map((segment, index) => {
          const fraction = segment.value / total;
          const dash = fraction * circumference;
          // Small gap between segments for definition.
          const gap = 2;
          const rotation = startFraction * 360 - 90;
          startFraction += fraction;
          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${Math.max(dash - gap, 0)} ${circumference}`}
              rotation={rotation}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
        })}
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

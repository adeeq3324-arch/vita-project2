import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, fontWeight } from '@/theme';

type CircularGaugeProps = {
  /** Current value, 0–max. */
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  /** Large centred number. Defaults to `value`. */
  label?: string;
  /** Small caption under the number, e.g. "Excellent". */
  caption?: string;
  gradient?: readonly [string, string];
};

/**
 * Rounded progress arc (a ~270° gauge) with a gradient stroke and a value
 * centred inside — the Health Score dial on the Home screen.
 */
export function CircularGauge({
  value,
  max = 100,
  size = 116,
  strokeWidth = 10,
  label,
  caption,
  gradient = [colors.success, colors.primary],
}: CircularGaugeProps) {
  const gradientId = `gauge-${useId().replace(/:/g, '')}`;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Draw a 270° arc (three-quarters), leaving a gap at the bottom.
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const progress = Math.max(0, Math.min(value / max, 1));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </LinearGradient>
        </Defs>
        {/* Rotate so the 270° arc's gap sits at the bottom centre. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceSunken}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          rotation={135}
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength * progress} ${circumference}`}
          rotation={135}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.value, { fontSize: size * 0.3 }]}>{label ?? value}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
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
  value: {
    color: colors.text.primary,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  caption: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: colors.success,
  },
});

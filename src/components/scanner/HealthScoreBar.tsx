import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

/**
 * Health-score readout: a red→amber→green gradient bar with a marker at the
 * score, and the score printed as "X/10".
 */
export function HealthScoreBar({ score, max = 10, label }: { score: number; max?: number; label?: string }) {
  const ratio = Math.max(0, Math.min(score / max, 1));

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Health Score</Text>
        <Text style={styles.score}>
          {score}
          <Text style={styles.scoreMax}>/{max}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={[colors.danger, colors.warning, colors.success]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.marker, { left: `${ratio * 100}%` }]} />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  score: {
    ...typography.h3,
    color: colors.success,
  },
  scoreMax: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  track: {
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  marker: {
    position: 'absolute',
    width: 4,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginLeft: -2,
  },
  label: {
    ...typography.label,
    color: colors.success,
    marginTop: spacing.sm,
  },
});

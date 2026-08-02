import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { Card } from '@/components/ui/Card';
import { colors, layout, spacing, typography } from '@/theme';

import type { FitnessStats, ProgressCharts } from '@/services/progress/progressService';

import { StatRow } from './StatRow';

/** Fitness Progress: workout-frequency bars with session, streak and duration totals. */
export function FitnessProgressCard({
  workout,
  fitnessStats,
  onLogWorkout,
}: {
  workout: ProgressCharts['workout'];
  fitnessStats: FitnessStats;
  onLogWorkout: () => void;
}) {
  const noSessions = workout.data.every((value) => value === 0);

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Fitness</Text>
        <Pressable
          onPress={onLogWorkout}
          accessibilityRole="button"
          accessibilityLabel="Log a workout"
          hitSlop={8}
          style={({ pressed }) => [styles.logBtn, pressed && styles.logBtnPressed]}
        >
          <Feather name="plus" size={13} color={colors.primary} />
          <Text style={styles.logBtnText}>Log workout</Text>
        </Pressable>
      </View>

      {noSessions ? (
        <Pressable onPress={onLogWorkout} accessibilityRole="button">
          <Text style={styles.empty}>
            No sessions in this period.{'\n'}Log one and the bars start filling.
          </Text>
        </Pressable>
      ) : (
        <BarChart data={workout.data} color={colors.metric.workout} height={88} />
      )}
      {noSessions ? null : (
        <View style={styles.labels}>
          {workout.labels.map((label) => (
            <Text key={label} style={styles.label}>
              {label}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.divider} />
      <StatRow
        stats={[
          { label: fitnessStats.sessions.label, value: fitnessStats.sessions.value, hint: fitnessStats.sessions.hint },
          { label: fitnessStats.streak.label, value: fitnessStats.streak.value, hint: fitnessStats.streak.hint },
          { label: fitnessStats.duration.label, value: fitnessStats.duration.value, hint: fitnessStats.duration.hint },
        ]}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySurface,
  },
  logBtnPressed: {
    opacity: 0.7,
  },
  logBtnText: {
    ...typography.micro,
    color: colors.primary,
  },
  empty: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  label: {
    ...typography.micro,
    color: colors.text.disabled,
  },
  divider: {
    height: layout.hairline,
    backgroundColor: colors.divider,
    marginVertical: spacing.base,
  },
});

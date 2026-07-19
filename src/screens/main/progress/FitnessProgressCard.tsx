import { StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { Card } from '@/components/ui/Card';
import { colors, layout, spacing, typography } from '@/theme';

import { StatRow } from './StatRow';
import { chartData, fitnessStats, type ProgressPeriod } from './progressData';

/** Fitness Progress: workout-frequency bars with session, streak and duration totals. */
export function FitnessProgressCard({ period }: { period: ProgressPeriod }) {
  const workout = chartData[period].workout;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Fitness</Text>
        <Text style={styles.headerMeta}>Workout frequency</Text>
      </View>

      <BarChart data={workout.data} color={colors.metric.workout} height={88} />
      <View style={styles.labels}>
        {workout.labels.map((label) => (
          <Text key={label} style={styles.label}>
            {label}
          </Text>
        ))}
      </View>

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
  headerMeta: {
    ...typography.micro,
    color: colors.text.tertiary,
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

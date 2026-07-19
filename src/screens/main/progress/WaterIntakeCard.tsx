import { StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

import { chartData, type ProgressPeriod } from './progressData';

/** Water Intake: daily hydration bars against the target. */
export function WaterIntakeCard({ period }: { period: ProgressPeriod }) {
  const water = chartData[period].water;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Water Intake</Text>
        <Text style={styles.value}>
          {water.today}
          <Text style={styles.unit}> / {water.target}</Text>
        </Text>
      </View>
      <BarChart data={water.data} color={colors.metric.water} height={84} />
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
  value: {
    ...typography.bodyStrong,
    color: colors.metric.water,
  },
  unit: {
    ...typography.label,
    color: colors.text.tertiary,
  },
});

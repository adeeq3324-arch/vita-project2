import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { Card } from '@/components/ui/Card';
import { colors, layout, spacing, typography } from '@/theme';

import { StatRow } from './StatRow';
import { bodyStats, chartData, type ProgressPeriod } from './progressData';

/** Body Progress: weight trend line plus BMI / body-fat / muscle measurements. */
export function BodyProgressCard({ period }: { period: ProgressPeriod }) {
  const weight = chartData[period].weight;
  const timeframe = period === 'week' ? 'vs last week' : 'vs last month';

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Body Progress</Text>
        <View style={styles.deltaCol}>
          <View style={styles.deltaRow}>
            <Feather
              name={weight.positive ? 'trending-down' : 'trending-up'}
              size={14}
              color={weight.positive ? colors.success : colors.danger}
            />
            <Text style={[styles.delta, { color: weight.positive ? colors.success : colors.danger }]}>
              {weight.delta}
            </Text>
          </View>
          <Text style={styles.timeframe}>{timeframe}</Text>
        </View>
      </View>

      <Text style={styles.axisLabel}>Weight (kg)</Text>
      <LineChart data={weight.data} labels={weight.labels} height={148} color={colors.primary} />

      <View style={styles.divider} />
      <StatRow
        stats={bodyStats.map((stat) => ({
          label: stat.label,
          value: stat.value,
          unit: stat.unit,
          icon: stat.icon,
        }))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  deltaCol: {
    alignItems: 'flex-end',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  delta: {
    ...typography.bodyStrong,
  },
  timeframe: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  axisLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  divider: {
    height: layout.hairline,
    backgroundColor: colors.divider,
    marginVertical: spacing.base,
  },
});

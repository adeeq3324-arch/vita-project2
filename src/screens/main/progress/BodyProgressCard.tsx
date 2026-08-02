import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/charts/LineChart';
import { Card } from '@/components/ui/Card';
import { colors, layout, spacing, typography } from '@/theme';

import type {
  BodyStat,
  ProgressCharts,
  ProgressPeriod,
} from '@/services/progress/progressService';
import { materialIcon } from '@/utils/icons';

import { StatRow } from './StatRow';

/** Body Progress: weight trend line plus BMI / body-fat / muscle measurements. */
export function BodyProgressCard({
  weight,
  bodyStats,
  period,
  onLogWeight,
}: {
  weight: ProgressCharts['weight'];
  bodyStats: BodyStat[];
  period: ProgressPeriod;
  onLogWeight: () => void;
}) {
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

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>Weight ({weight.unit})</Text>
        <Pressable
          onPress={onLogWeight}
          accessibilityRole="button"
          accessibilityLabel="Log your weight"
          hitSlop={8}
          style={({ pressed }) => [styles.logBtn, pressed && styles.logBtnPressed]}
        >
          <Feather name="plus" size={13} color={colors.primary} />
          <Text style={styles.logBtnText}>Log weight</Text>
        </Pressable>
      </View>
      {weight.data.length > 0 ? (
        <LineChart data={weight.data} labels={weight.labels} height={148} color={colors.primary} />
      ) : (
        <Pressable onPress={onLogWeight} accessibilityRole="button">
          <Text style={styles.chartEmpty}>
            No weigh-ins in this period.{'\n'}Tap “Log weight” to start the trend.
          </Text>
        </Pressable>
      )}

      <View style={styles.divider} />
      <StatRow
        stats={bodyStats.map((stat) => ({
          label: stat.label,
          value: stat.value,
          unit: stat.unit,
          icon: materialIcon(stat.icon),
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
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  axisLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
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
  chartEmpty: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  divider: {
    height: layout.hairline,
    backgroundColor: colors.divider,
    marginVertical: spacing.base,
  },
});

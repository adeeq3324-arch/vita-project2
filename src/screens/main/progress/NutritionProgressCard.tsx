import { StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { Card } from '@/components/ui/Card';
import { colors, layout, radius, spacing, typography } from '@/theme';

import type { MacroLegend, ProgressCharts } from '@/services/progress/progressService';
import { metricName } from '@/utils/icons';

/** Nutrition Progress: average-calorie bars and the macro-distribution donut. */
export function NutritionProgressCard({
  calories,
  macros,
}: {
  calories: ProgressCharts['calories'];
  macros: MacroLegend[];
}) {
  const totalGrams = macros.reduce((sum, macro) => sum + macro.grams, 0);
  const segments = macros
    .filter((macro) => macro.grams > 0)
    .map((macro) => ({ value: macro.grams, color: colors.metric[metricName(macro.metric)] }));

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition</Text>
        <Text style={styles.headerMeta}>Avg intake</Text>
      </View>

      <View style={styles.caloriesRow}>
        <Text style={styles.calories}>
          {calories.average}
          <Text style={styles.caloriesUnit}> / {calories.target}</Text>
        </Text>
      </View>
      <BarChart data={calories.data} color={colors.metric.calories} height={92} highlightLast />

      <View style={styles.divider} />

      <Text style={styles.subTitle}>Macros Distribution</Text>
      <View style={styles.macrosRow}>
        <DonutChart
          segments={segments}
          size={116}
          centerLabel={`${Math.round(totalGrams)}g`}
          centerSub="total"
        />
        <View style={styles.legend}>
          {macros.map((macro) => (
            <View key={macro.key} style={styles.legendRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: colors.metric[metricName(macro.metric)] },
                ]}
              />
              <Text style={styles.legendLabel}>{macro.label}</Text>
              <Text style={styles.legendValue}>
                {macro.grams}g <Text style={styles.legendPercent}>({macro.percent}%)</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  headerMeta: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  caloriesRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  calories: {
    ...typography.h3,
    color: colors.text.primary,
  },
  caloriesUnit: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  divider: {
    height: layout.hairline,
    backgroundColor: colors.divider,
    marginVertical: spacing.base,
  },
  subTitle: {
    ...typography.bodyStrong,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  legend: {
    flex: 1,
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  legendLabel: {
    ...typography.label,
    color: colors.text.secondary,
    flex: 1,
  },
  legendValue: {
    ...typography.label,
    color: colors.text.primary,
  },
  legendPercent: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});

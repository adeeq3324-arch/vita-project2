import { StyleSheet, Text, View } from 'react-native';

import { DonutChart } from '@/components/charts/DonutChart';
import { colors, radius, spacing, typography } from '@/theme';

import { formatGrams } from './PlannedMealCard';

/**
 * Energy per gram, used to turn a meal's nutrients into the share of its
 * calories each one contributes.
 *
 * Fibre is counted at the 2 kcal/g the EU and several other regulators use for
 * the fraction that is fermented, rather than at the 4 kcal/g of the
 * carbohydrate it is nominally part of. Without that it would be double-counted
 * against carbs and the ring would consistently overstate the meal.
 */
const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
  fiber: 2,
} as const;

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * The calorie ring and its legend.
 *
 * Percentages are of the *energy* each nutrient supplies, not of the grams: 12 g
 * of fat and 46 g of carbohydrate are close to the same number of calories, and
 * a chart drawn on grams would show the opposite of what the meal actually is.
 */
export function NutritionBreakdown({ nutrients }: { nutrients: Nutrients }) {
  const rows = [
    {
      label: 'Protein',
      grams: nutrients.protein,
      energy: nutrients.protein * KCAL_PER_GRAM.protein,
      color: colors.metric.protein,
    },
    {
      label: 'Carbs',
      grams: nutrients.carbs,
      energy: nutrients.carbs * KCAL_PER_GRAM.carbs,
      color: colors.metric.carbs,
    },
    {
      label: 'Fat',
      grams: nutrients.fat,
      energy: nutrients.fat * KCAL_PER_GRAM.fat,
      color: colors.metric.fat,
    },
    {
      label: 'Fiber',
      grams: nutrients.fiber,
      energy: nutrients.fiber * KCAL_PER_GRAM.fiber,
      color: colors.metric.fiber,
    },
  ];

  // Shares are taken against the energy actually accounted for rather than the
  // stated calorie figure. The two rarely agree exactly — rounding, alcohol,
  // sugar alcohols — and dividing by the stated figure would leave a ring whose
  // segments visibly do not close.
  const totalEnergy = rows.reduce((sum, row) => sum + row.energy, 0);

  return (
    <View style={styles.container}>
      <DonutChart
        segments={rows.map((row) => ({ value: row.energy, color: row.color }))}
        size={124}
        strokeWidth={18}
        centerLabel={nutrients.kcal.toLocaleString()}
        centerSub="kcal"
      />

      <View style={styles.legend}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: row.color }]} />
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.grams}>{formatGrams(row.grams)}</Text>
            <Text style={styles.share}>({share(row.energy, totalEnergy)})</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A nutrient's share of the meal's energy, as a whole percentage. */
function share(energy: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((energy / total) * 100)}%`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  legend: {
    flex: 1,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  grams: {
    ...typography.label,
    color: colors.plan.ink,
  },
  share: {
    ...typography.micro,
    color: colors.text.tertiary,
    width: 40,
    textAlign: 'right',
  },
});

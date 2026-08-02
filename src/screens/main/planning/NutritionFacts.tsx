import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { MealNutritionFacts, MealSource } from '@/services/planning/planningService';

/**
 * The measured figures behind a dish, and where they came from.
 *
 * These are the numbers a plan cannot honestly estimate and a user with a
 * condition was told to watch — saturated fat, sugar, sodium. They are shown
 * apart from the macros for that reason: the macros are what the plan was
 * *built* from and every daily total sums them, while these are what it should
 * be *checked* against.
 *
 * The whole panel disappears when nothing was matched. An empty facts table
 * with five dashes in it looks like a dish with no sodium in it rather than a
 * dish nobody has weighed, and the second is the truth.
 */

/** One row of the panel: what it is, how much, and how it is measured. */
interface Fact {
  label: string;
  value: number | null;
  unit: 'g' | 'mg';
}

export function NutritionFacts({
  facts,
  source,
}: {
  facts: MealNutritionFacts | null;
  source: MealSource | null;
}) {
  if (!facts) return null;

  const rows: Fact[] = [
    { label: 'Saturated fat', value: facts.saturatedFat, unit: 'g' },
    { label: 'Sugar', value: facts.sugar, unit: 'g' },
    { label: 'Sodium', value: facts.sodiumMg, unit: 'mg' },
    { label: 'Cholesterol', value: facts.cholesterolMg, unit: 'mg' },
    { label: 'Potassium', value: facts.potassiumMg, unit: 'mg' },
  ];

  // A published recipe reports what it reports. Rows it said nothing about are
  // dropped rather than dashed, so every line on the panel is a real figure.
  const known = rows.filter((row): row is Fact & { value: number } => row.value !== null);
  if (known.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Facts</Text>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="check-decagram" size={13} color={colors.success} />
          <Text style={styles.badgeText}>Verified</Text>
        </View>
      </View>

      <Text style={styles.caption}>
        Measured from a published recipe for this dish, scaled to your portion.
      </Text>

      <View style={styles.panel}>
        {known.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.rowDivided]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>
              {format(row.value)}
              <Text style={styles.rowUnit}> {row.unit}</Text>
            </Text>
          </View>
        ))}
      </View>

      <SourceCredit source={source} />
    </View>
  );
}

/**
 * Attribution for a dish or a method that somebody published.
 *
 * Tappable when there is somewhere to go, plain text when there is not — a
 * credit that looks like a link and does nothing is worse than one that never
 * offered.
 */
export function SourceCredit({ source }: { source: MealSource | null }) {
  if (!source) return null;

  const label = `Recipe by ${source.name}`;

  if (!source.url) {
    return (
      <View style={styles.credit}>
        <MaterialCommunityIcons name="book-open-variant" size={13} color={colors.text.tertiary} />
        <Text style={styles.creditText}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void Linking.openURL(source.url as string)}
      accessibilityRole="link"
      accessibilityLabel={`${label}. Opens the original recipe.`}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.credit, pressed && styles.creditPressed]}
    >
      <MaterialCommunityIcons name="book-open-variant" size={13} color={colors.plan.mealDark} />
      <Text style={[styles.creditText, styles.creditLink]}>{label}</Text>
      <MaterialCommunityIcons name="open-in-new" size={12} color={colors.plan.mealDark} />
    </Pressable>
  );
}

/** Whole numbers above ten, one decimal below — "412 mg", but "1.8 g". */
function format(value: number): string {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.successSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.micro,
    color: colors.success,
  },
  caption: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: -spacing.xs,
    lineHeight: 18,
  },
  panel: {
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  rowValue: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  rowUnit: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  creditPressed: {
    opacity: 0.6,
  },
  creditText: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  creditLink: {
    color: colors.plan.mealDark,
  },
});

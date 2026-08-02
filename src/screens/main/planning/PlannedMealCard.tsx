import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { PlannedMeal } from '@/services/planning/planningService';

import { MEAL_ICON, MEAL_LABEL } from './mealMeta';
import { formatClockTime } from './mealTime';
import { PlanImage } from './PlanImage';

/**
 * One meal in the day's list: when to eat it, which sitting it is, what it is,
 * and what it costs against the day's targets.
 *
 * The four nutrients are shown on the card rather than saved for the detail
 * screen because scanning a day is the whole point of a plan — a user deciding
 * whether today's meals work for them should not have to open four screens to
 * find out.
 */
export function PlannedMealCard({
  meal,
  onPress,
}: {
  meal: PlannedMeal;
  onPress: () => void;
}) {
  const nutrients = [
    { key: 'P', value: meal.protein, color: colors.metric.protein },
    { key: 'C', value: meal.carbs, color: colors.metric.carbs },
    { key: 'F', value: meal.fat, color: colors.metric.fat },
    { key: 'Fiber', value: meal.fiber, color: colors.metric.fiber },
  ];

  const time = formatClockTime(meal.scheduledTime);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        time ? `${MEAL_LABEL[meal.mealType]} at ${time}` : MEAL_LABEL[meal.mealType],
        `${meal.name}, ${meal.kcal} kilocalories`,
      ].join(': ')}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card padding="sm" style={styles.card}>
        <View style={styles.copy}>
          <View style={styles.meta}>
            <View style={styles.typeChip}>
              <MaterialCommunityIcons
                name={MEAL_ICON[meal.mealType]}
                size={11}
                color={colors.plan.mealDark}
              />
              <Text style={styles.typeText}>{MEAL_LABEL[meal.mealType]}</Text>
            </View>

            {/*
              The time sits beside the sitting rather than replacing it: "Lunch"
              is what the meal is for, "12:30 PM" is when the day expects it, and
              a user planning around a shift or a training session needs both.
            */}
            {time ? (
              <View style={styles.timeChip}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={11}
                  color={colors.text.tertiary}
                />
                <Text style={styles.timeText}>{time}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {meal.name}
          </Text>
          <View style={styles.energy}>
            <Text style={styles.kcal}>{meal.kcal.toLocaleString()} kcal</Text>
            {/*
              Only ever a *positive* mark, and only when the figures came from a
              recipe somebody weighed. An "estimated" badge on every other card
              would be noise on the common case; the absence of this one is what
              carries the meaning.
            */}
            {meal.nutritionSource === 'verified' ? (
              <View style={styles.verified}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={11}
                  color={colors.success}
                />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.nutrients}>
            {nutrients.map((nutrient) => (
              <View key={nutrient.key} style={styles.nutrient}>
                <View style={[styles.dot, { backgroundColor: nutrient.color }]} />
                <Text style={styles.nutrientText}>
                  {nutrient.key} {formatGrams(nutrient.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <PlanImage
          uri={meal.imageUrl}
          icon={MEAL_ICON[meal.mealType]}
          tint={{ surface: colors.plan.mealSurface, color: colors.plan.meal }}
          style={styles.thumb}
        />
      </Card>
    </Pressable>
  );
}

/** Grams to one decimal at most — "24g", not "24.0g". */
export function formatGrams(value: number): string {
  return `${Math.round(value * 10) / 10}g`;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.plan.mealSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  typeText: {
    ...typography.micro,
    color: colors.plan.mealDark,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    // Unfilled where the sitting chip is filled: the two carry different weights
    // of information and should not compete for the same glance.
    paddingVertical: 3,
  },
  timeText: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  energy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kcal: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedText: {
    ...typography.micro,
    color: colors.success,
  },
  nutrients: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  nutrient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  nutrientText: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
  },
});

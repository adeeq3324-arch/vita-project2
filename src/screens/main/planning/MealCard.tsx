import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { PlannedMeal } from '@/services/ai';

const mealTypeLabel: Record<PlannedMeal['type'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/**
 * One meal row in the day plan: thumbnail glyph, name, calories and prep time.
 * When `onPress` is provided the row is tappable and opens the meal detail.
 */
export function MealCard({ meal, onPress }: { meal: PlannedMeal; onPress?: () => void }) {
  const content = (
    <Card padding="sm" style={styles.card}>
      <View style={[styles.thumb, { backgroundColor: colors.accentSurface[meal.accent] }]}>
        <MaterialCommunityIcons name={meal.icon} size={26} color={colors.accent[meal.accent]} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.type}>{mealTypeLabel[meal.type]}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {meal.name}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="fire" size={13} color={colors.metric.calories} />
            <Text style={styles.metaText}>{meal.kcal} kcal</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.text.tertiary} />
            <Text style={styles.metaText}>{meal.prepMin} min</Text>
          </View>
        </View>
      </View>
      {onPress ? <Feather name="chevron-right" size={18} color={colors.text.disabled} /> : null}
    </Card>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${mealTypeLabel[meal.type]}: ${meal.name}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  type: {
    ...typography.micro,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text.primary,
    marginTop: 1,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});

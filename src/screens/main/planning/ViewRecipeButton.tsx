import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

/**
 * The way into the recipe, from the meal it belongs to.
 *
 * Sits in the scroll rather than the footer, and looks like a destination rather
 * than a link. The footer is where "swap this meal" lives — the action that
 * rejects the dish — and putting the two side by side would make the more
 * committed choice compete with the easier one every time a user looks at a
 * meal.
 */
export function ViewRecipeButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View full recipe"
      accessibilityHint="Opens the ingredients, method, timings and tips for this dish"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <MaterialCommunityIcons name="chef-hat" size={22} color={colors.plan.mealDark} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>View Full Recipe</Text>
        <Text style={styles.subtitle}>Ingredients, method, timings & chef’s tips</Text>
      </View>

      <Feather name="chevron-right" size={20} color={colors.plan.mealDark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.base,
    backgroundColor: colors.plan.mealSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.plan.meal,
  },
  pressed: {
    opacity: 0.75,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  subtitle: {
    ...typography.micro,
    color: colors.text.secondary,
  },
});

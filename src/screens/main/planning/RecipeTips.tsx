import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

/**
 * The advice a cook would give you over your shoulder: the substitution, the
 * mistake to avoid, what to do with what is left.
 *
 * Kept in its own tinted card at the end rather than folded into the steps. It
 * is the part that is worth reading before you start and useless in the middle
 * of step four, and mixing it into the method would make the method longer
 * without making it clearer.
 */
export function RecipeTips({ tips }: { tips: readonly string[] }) {
  if (tips.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="lightbulb-on"
          size={16}
          color={colors.plan.mealDark}
        />
        <Text style={styles.title}>Chef’s Tips</Text>
      </View>

      <View style={styles.list}>
        {tips.map((tip, index) => (
          <View key={`${index}-${tip.slice(0, 24)}`} style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.text}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.base,
    padding: spacing.base,
    gap: spacing.md,
    backgroundColor: colors.plan.mealSurface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.plan.mealDark,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.plan.meal,
    marginTop: 8,
  },
  text: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 21,
  },
});

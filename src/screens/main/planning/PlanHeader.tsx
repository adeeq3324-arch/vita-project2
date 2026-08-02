import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { colors, layout, radius, spacing, typography } from '@/theme';

type PlanHeaderProps = {
  title: string;
  /** The span the plan covers: "This week", "July 2025". */
  subtitle: string;
  /** Regenerates the plan. Omitted while there is no plan to regenerate. */
  onRegenerate?: () => void;
  regenerating?: boolean;
};

/**
 * Header for the two plan screens: back, the plan's name over the period it
 * covers, and the regenerate action.
 *
 * Left-aligned rather than centred like {@link DetailHeader}, because the period
 * underneath is part of the title — a plan is only meaningful as "this week's"
 * or "July's", and stacking the two is what makes that read as one statement.
 */
export function PlanHeader({ title, subtitle, onRegenerate, regenerating = false }: PlanHeaderProps) {
  return (
    <View style={styles.row}>
      <BackButton />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {onRegenerate ? (
        <Pressable
          onPress={onRegenerate}
          disabled={regenerating}
          accessibilityRole="button"
          accessibilityLabel="Regenerate plan"
          accessibilityState={{ busy: regenerating, disabled: regenerating }}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          {regenerating ? (
            <ActivityIndicator size="small" color={colors.text.secondary} />
          ) : (
            <Feather name="refresh-cw" size={18} color={colors.plan.ink} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.plan.ink,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  action: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    backgroundColor: colors.surfaceSunken,
  },
});

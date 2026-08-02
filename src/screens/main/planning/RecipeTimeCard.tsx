import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { RecipeDifficulty } from '@/services/planning/planningService';

/**
 * The three questions asked before anyone decides to cook something: how long
 * until I can start, how long on the stove, and how long in total.
 *
 * Total is given its own tinted cell rather than being left for the reader to
 * add up. It is the only one of the three that answers "can I make this
 * tonight", and a card that shows two numbers and expects arithmetic is a card
 * that gets misread in the direction the reader hopes for.
 */

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

const DIFFICULTY: Record<RecipeDifficulty, { label: string; color: string; surface: string }> = {
  easy: { label: 'Easy', color: colors.success, surface: colors.successSurface },
  medium: { label: 'Medium', color: colors.warning, surface: colors.warningSurface },
  hard: { label: 'Hard', color: colors.danger, surface: colors.dangerSurface },
};

export function RecipeTimeCard({
  prepMinutes,
  cookMinutes,
  totalMinutes,
  servings,
  difficulty,
  cuisine,
}: {
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  servings: number;
  difficulty: RecipeDifficulty;
  cuisine: string;
}) {
  const level = DIFFICULTY[difficulty];

  return (
    <View style={styles.wrap}>
      <Card padding="none" style={styles.card}>
        <TimeCell icon="knife" label="Prep" value={formatMinutes(prepMinutes)} />
        <View style={styles.divider} />
        <TimeCell icon="pot-steam" label="Cook" value={formatMinutes(cookMinutes)} />
        <View style={styles.divider} />
        <TimeCell icon="clock-outline" label="Total" value={formatMinutes(totalMinutes)} emphasis />
      </Card>

      <View style={styles.chips}>
        <Chip
          icon="chef-hat"
          label={level.label}
          color={level.color}
          surface={level.surface}
        />
        <Chip
          icon="account-group"
          label={`${servings} ${servings === 1 ? 'serving' : 'servings'}`}
          color={colors.plan.mealDark}
          surface={colors.plan.mealSurface}
        />
        {cuisine ? (
          <Chip
            icon="earth"
            label={cuisine}
            color={colors.text.secondary}
            surface={colors.surfaceSunken}
          />
        ) : null}
      </View>
    </View>
  );
}

function TimeCell({
  icon,
  label,
  value,
  emphasis = false,
}: {
  icon: Glyph;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.cell}>
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={emphasis ? colors.plan.mealDark : colors.text.tertiary}
      />
      <Text style={[styles.value, emphasis && styles.valueEmphasis]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function Chip({
  icon,
  label,
  color,
  surface,
}: {
  icon: Glyph;
  label: string;
  color: string;
  surface: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: surface }]}>
      <MaterialCommunityIcons name={icon} size={12} color={color} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Minutes as a cook reads them: "45 min" up to the hour, "1h 30m" past it.
 *
 * A three-hour braise written as "180 min" is a number the reader has to convert
 * before it means anything, and the conversion is where a slow Sunday dish gets
 * mistaken for a weeknight one.
 */
export function formatMinutes(total: number): string {
  if (total <= 0) return 'None';
  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: spacing.xxs,
  },
  value: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  valueEmphasis: {
    color: colors.plan.mealDark,
  },
  label: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: {
    ...typography.micro,
    flexShrink: 1,
  },
});

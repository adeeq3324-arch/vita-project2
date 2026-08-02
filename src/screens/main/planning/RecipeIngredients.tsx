import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { RecipeIngredient } from '@/services/planning/planningService';

/**
 * The shopping list, as something to work through rather than something to read.
 *
 * Each line can be ticked off, because that is what the list is actually used
 * for — standing in a shop, or laying things out on a counter — and a list you
 * can lose your place in is a list that sends you back to the shop. The state is
 * deliberately local and unsaved: it belongs to one cooking session, and a tick
 * still showing next to "olive oil" three days later would be worse than no tick
 * at all.
 */
export function RecipeIngredients({
  ingredients,
  servings,
}: {
  ingredients: readonly RecipeIngredient[];
  servings: number;
}) {
  const [gathered, setGathered] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = useCallback((index: number) => {
    setGathered((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }, []);

  if (ingredients.length === 0) return null;

  const done = gathered.size;
  const total = ingredients.length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Ingredients</Text>
          <Text style={styles.subtitle}>
            {total} items · makes {servings} {servings === 1 ? 'serving' : 'servings'}
          </Text>
        </View>
        <Text style={styles.counter}>
          {done}/{total}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${total === 0 ? 0 : (done / total) * 100}%` }]}
        />
      </View>

      <View style={styles.list}>
        {ingredients.map((ingredient, index) => (
          <IngredientRow
            key={`${ingredient.name}-${index}`}
            ingredient={ingredient}
            checked={gathered.has(index)}
            divided={index > 0}
            onToggle={() => toggle(index)}
          />
        ))}
      </View>
    </View>
  );
}

function IngredientRow({
  ingredient,
  checked,
  divided,
  onToggle,
}: {
  ingredient: RecipeIngredient;
  checked: boolean;
  /** Rules off from the row above. False on the first, which the panel already borders. */
  divided: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${ingredient.quantity} ${ingredient.name}`}
      style={({ pressed }) => [
        styles.row,
        divided && styles.rowDivided,
        checked && styles.rowChecked,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <MaterialCommunityIcons name="check" size={13} color={colors.white} /> : null}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.name, checked && styles.struck]}>{ingredient.name}</Text>
        {ingredient.note ? <Text style={styles.note}>{ingredient.note}</Text> : null}
      </View>

      <Text style={[styles.quantity, checked && styles.quantityChecked]}>
        {ingredient.quantity}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  counter: {
    ...typography.label,
    color: colors.plan.mealDark,
  },
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
    marginTop: -spacing.xs,
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.plan.meal,
  },
  list: {
    borderRadius: radius.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  rowChecked: {
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.6,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.xs + 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.plan.meal,
    borderColor: colors.plan.meal,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.body,
    color: colors.plan.ink,
  },
  struck: {
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  note: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  quantity: {
    ...typography.bodyStrong,
    color: colors.text.secondary,
  },
  quantityChecked: {
    color: colors.text.disabled,
  },
});

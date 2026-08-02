import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { SupplementTier } from '@/services/planning/planningService';

export type TierFilterValue = 'all' | SupplementTier;

type TierFilterProps = {
  value: TierFilterValue;
  onChange: (value: TierFilterValue) => void;
  counts: { all: number; core: number; optional: number };
};

const OPTIONS: readonly { value: TierFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core' },
  { value: 'optional', label: 'Optional' },
];

/**
 * Narrows the regimen to what the user is asked to commit to, or to what is
 * merely on offer.
 *
 * A filter with nothing behind it is worse than no filter, so a tier the plan
 * produced none of is not offered — the model is asked for few, well-justified
 * items, and a regimen of three core supplements and no optional ones is a
 * perfectly ordinary result.
 */
export function TierFilter({ value, onChange, counts }: TierFilterProps) {
  const available = OPTIONS.filter((option) => counts[option.value] > 0);
  if (available.length < 2) return null;

  return (
    <View style={styles.row}>
      {available.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${option.label}, ${counts[option.value]} supplements`}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.label,
    color: colors.text.secondary,
  },
  labelSelected: {
    color: colors.white,
  },
});

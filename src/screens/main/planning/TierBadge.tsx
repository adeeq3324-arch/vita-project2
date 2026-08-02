import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { SupplementTier } from '@/services/planning/planningService';

/**
 * Marks a supplement as one the regimen depends on or one it merely offers.
 *
 * Coloured rather than neutral for `core`: the distinction is the single most
 * useful thing on the card — it is what tells a user which two of six items
 * matter if they only take two — and a badge that has to be read rather than
 * glanced at would not carry it.
 */
export function TierBadge({ tier }: { tier: SupplementTier }) {
  const core = tier === 'core';

  return (
    <View style={[styles.badge, core ? styles.core : styles.optional]}>
      <Text style={[styles.text, core ? styles.coreText : styles.optionalText]}>
        {core ? 'Core' : 'Optional'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  core: {
    backgroundColor: colors.plan.supplementSurface,
  },
  optional: {
    backgroundColor: colors.surfaceSunken,
  },
  text: {
    ...typography.micro,
  },
  coreText: {
    color: colors.plan.supplementDark,
  },
  optionalText: {
    color: colors.text.tertiary,
  },
});

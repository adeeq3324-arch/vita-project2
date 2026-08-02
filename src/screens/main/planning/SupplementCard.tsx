import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { PlannedSupplement } from '@/services/planning/planningService';

import { PlanImage } from './PlanImage';
import { TierBadge } from './TierBadge';

/**
 * One supplement in the regimen.
 *
 * The timing sits alone at the foot of the card. It is the one instruction the
 * user has to act on every day, and giving it the full width rather than half of
 * a split row is what keeps it readable at a glance.
 */
export function SupplementCard({
  supplement,
  onPress,
}: {
  supplement: PlannedSupplement;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${supplement.name}, ${supplement.headline}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card padding="sm" style={styles.card}>
        <View style={styles.top}>
          <PlanImage
            uri={supplement.imageUrl}
            icon="pill"
            tint={{ surface: colors.plan.supplementSurface, color: colors.plan.supplementDark }}
            iconSize={26}
            style={styles.thumb}
          />

          <View style={styles.copy}>
            <TierBadge tier={supplement.tier} />
            <Text style={styles.name} numberOfLines={1}>
              {supplement.name}
            </Text>
            <Text style={styles.headline} numberOfLines={2}>
              {supplement.headline}
            </Text>
          </View>

          <Feather name="chevron-right" size={18} color={colors.text.disabled} />
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Best Time</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {supplement.bestTimeLabel}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
  },
  copy: {
    flex: 1,
    gap: 3,
    alignItems: 'flex-start',
  },
  name: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  headline: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  metaValue: {
    ...typography.label,
    color: colors.plan.ink,
  },
  metaLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});

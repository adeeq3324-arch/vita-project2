import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type PlanBannerProps = {
  title: string;
  subtitle: string;
  /** Fill colour — the domain accent of the plan it sits on. */
  tint: string;
  /** Present when the banner leads somewhere; otherwise it is a statement. */
  onPress?: () => void;
};

/**
 * The filled strip at the top of a ready plan.
 *
 * It carries the one thing a generated plan has to say before anything else —
 * that it exists, and that it was built for this person. Solid rather than
 * tinted so it reads as the plan announcing itself rather than as another card
 * in the list underneath it.
 */
export function PlanBanner({ title, subtitle, tint, onPress }: PlanBannerProps) {
  const content = (
    <View style={[styles.banner, { backgroundColor: tint }]}>
      <MaterialCommunityIcons name="star-four-points" size={18} color={colors.white} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {onPress ? (
        <View style={styles.chevron}>
          <Feather name="arrow-right" size={16} color={colors.white} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  pressed: {
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.white,
  },
  subtitle: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.9,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
});

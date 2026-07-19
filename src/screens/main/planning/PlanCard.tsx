import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '@/theme';
import type { AIIcon } from '@/services/ai/types';

type PlanCardProps = {
  title: string;
  subtitle: string;
  icon: AIIcon;
  gradient: readonly [string, string];
  onPress: () => void;
};

/**
 * Full-bleed gradient plan card (Meal Plan / Supplement Plan) with a "View
 * Plan" pill and a large glyph standing in for the plan artwork.
 */
export function PlanCard({ title, subtitle, icon, gradient, onPress }: PlanCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.button}>
            <Text style={styles.buttonText}>View Plan</Text>
            <MaterialCommunityIcons name="arrow-right" size={15} color={colors.white} />
          </View>
        </View>
        <View style={styles.art}>
          <MaterialCommunityIcons name={icon} size={56} color="rgba(255,255,255,0.9)" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    ...shadows.md,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.white,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginTop: spacing.base,
  },
  buttonText: {
    ...typography.label,
    color: colors.white,
  },
  art: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
});

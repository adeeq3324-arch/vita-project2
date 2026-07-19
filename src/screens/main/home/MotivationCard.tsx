import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, gradients, radius, shadows, spacing, typography } from '@/theme';

import { motivation } from './homeData';

/**
 * Daily Motivation: a brand-gradient card closing the Home feed with a quote.
 */
export function MotivationCard() {
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="format-quote-close" size={20} color={colors.white} />
      </View>
      <Text style={styles.quote}>{motivation.quote}</Text>
      <Text style={styles.author}>{motivation.author}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.primary,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  quote: {
    ...typography.h3,
    color: colors.white,
    lineHeight: 26,
  },
  author: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.sm,
  },
});

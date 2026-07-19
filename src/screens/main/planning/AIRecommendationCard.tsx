import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

/** Violet AI recommendation panel used across Home and Planning. */
export function AIRecommendationCard({ text }: { text: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.robot}>
        <MaterialCommunityIcons name="robot-happy" size={22} color={colors.white} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>AI Recommendation</Text>
        <Text style={styles.message}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.primary + '22',
  },
  robot: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});

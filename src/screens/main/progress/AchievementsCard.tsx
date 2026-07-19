import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

import { achievements, type Achievement } from './progressData';

/** Achievement system: a horizontal rail of earned and locked badges. */
export function AchievementsCard() {
  const earned = achievements.filter((a) => a.unlocked).length;

  return (
    <Card padding="none" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.count}>
          {earned}/{achievements.length} earned
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {achievements.map((achievement) => (
          <Badge key={achievement.key} achievement={achievement} />
        ))}
      </ScrollView>
    </Card>
  );
}

function Badge({ achievement }: { achievement: Achievement }) {
  const { unlocked, color, icon, label } = achievement;
  return (
    <View style={styles.badge}>
      <View
        style={[
          styles.medal,
          { backgroundColor: unlocked ? color : colors.surfaceSunken },
        ]}
      >
        <MaterialCommunityIcons
          name={unlocked ? icon : 'lock'}
          size={22}
          color={unlocked ? colors.white : colors.text.disabled}
        />
      </View>
      <Text style={[styles.badgeLabel, !unlocked && styles.badgeLabelLocked]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  count: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  rail: {
    paddingHorizontal: spacing.base,
    gap: spacing.base,
  },
  badge: {
    width: 68,
    alignItems: 'center',
    gap: spacing.xs,
  },
  medal: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    ...typography.micro,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  badgeLabelLocked: {
    color: colors.text.disabled,
  },
});

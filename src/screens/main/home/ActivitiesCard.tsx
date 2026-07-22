import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, layout, radius, spacing, typography } from '@/theme';

import { activitiesFor, type Activity } from './homeData';

/**
 * Today's Activities: Meals, Workout, Supplements, Reminders — each a row with
 * its completion state on the right. Reflects the day selected in the week strip.
 */
export function ActivitiesCard({ date }: { date: Date }) {
  const activities = activitiesFor(date);

  return (
    <Card padding="none" style={styles.card}>
      {activities.map((activity, index) => (
        <View key={activity.key}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <ActivityRow activity={activity} />
        </View>
      ))}
    </Card>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: colors.accentSurface[activity.accent] }]}>
        <MaterialCommunityIcons name={activity.icon} size={18} color={colors.accent[activity.accent]} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{activity.label}</Text>
        <Text style={styles.detail} numberOfLines={1}>
          {activity.detail}
        </Text>
      </View>
      {activity.done ? (
        <View style={styles.check}>
          <Feather name="check" size={14} color={colors.white} />
        </View>
      ) : (
        <Feather name="clock" size={20} color={colors.text.disabled} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    height: layout.hairline,
    backgroundColor: colors.divider,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  detail: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, layout, radius, spacing, typography } from '@/theme';

import type { HomeActivity } from '@/services/home/homeService';
import { accentName, materialIcon } from '@/utils/icons';

/**
 * Today's Activities: meals, workout, water, steps — each a row with its
 * completion state on the right. Reflects the day selected in the week strip.
 */
export function ActivitiesCard({ activities }: { activities: HomeActivity[] }) {
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

function ActivityRow({ activity }: { activity: HomeActivity }) {
  const accent = accentName(activity.accent);

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: colors.accentSurface[accent] }]}>
        <MaterialCommunityIcons
          name={materialIcon(activity.icon)}
          size={18}
          color={colors.accent[accent]}
        />
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

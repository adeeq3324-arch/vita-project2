import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

import type { Achievement } from '@/services/progress/progressService';

/** Milestones: goal-tracking rows with a labelled progress bar each. */
export function MilestonesCard({ milestones }: { milestones: Achievement[] }) {
  if (milestones.length === 0) return null;

  return (
    <Card>
      <Text style={styles.title}>Milestones</Text>
      <View style={styles.list}>
        {milestones.map((milestone) => (
          <View key={milestone.key} style={styles.item}>
            <View style={styles.itemHeader}>
              <Text style={styles.label}>{milestone.label}</Text>
              <Text style={styles.percent}>{milestone.percent}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${milestone.percent}%` }]} />
            </View>
            <Text style={styles.detail}>{milestone.detail}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.base,
  },
  list: {
    gap: spacing.base,
  },
  item: {
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  percent: {
    ...typography.label,
    color: colors.primary,
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  detail: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});

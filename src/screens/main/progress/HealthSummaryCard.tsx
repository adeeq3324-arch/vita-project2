import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CircularGauge } from '@/components/charts/CircularGauge';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

import { fitnessStats, healthScore } from './progressData';

/**
 * Top-of-Progress summary: the Health Score dial beside the month-over-month
 * change and two headline totals.
 */
export function HealthSummaryCard() {
  return (
    <Card>
      <View style={styles.body}>
        <CircularGauge value={healthScore.value} caption={healthScore.caption} size={112} />
        <View style={styles.side}>
          <Text style={styles.title}>Health Score</Text>
          <View style={styles.deltaRow}>
            <Feather name="trending-up" size={14} color={colors.success} />
            <Text style={styles.delta}>{healthScore.vsLast}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fitnessStats.streak.value}</Text>
              <Text style={styles.statLabel}>day streak</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fitnessStats.sessions.value}</Text>
              <Text style={styles.statLabel}>sessions</Text>
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    marginLeft: spacing.base,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  delta: {
    ...typography.label,
    color: colors.success,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.base,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.sm,
  },
});

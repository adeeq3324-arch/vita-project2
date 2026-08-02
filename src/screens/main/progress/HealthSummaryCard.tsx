import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CircularGauge } from '@/components/charts/CircularGauge';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

import type {
  FitnessStats,
  ProgressHealthScore,
} from '@/services/progress/progressService';

/**
 * Top-of-Progress summary: the Health Score dial beside the period-over-period
 * change and two headline totals.
 */
export function HealthSummaryCard({
  healthScore,
  fitnessStats,
}: {
  healthScore: ProgressHealthScore;
  fitnessStats: FitnessStats;
}) {
  const improved = (healthScore.delta ?? 0) >= 0;

  return (
    <Card>
      <View style={styles.body}>
        <CircularGauge
          value={healthScore.value ?? 0}
          caption={healthScore.caption ?? 'Not scored'}
          size={112}
        />
        <View style={styles.side}>
          <Text style={styles.title}>Health Score</Text>
          {healthScore.vsLast ? (
            <View style={styles.deltaRow}>
              <Feather
                name={improved ? 'trending-up' : 'trending-down'}
                size={14}
                color={improved ? colors.success : colors.danger}
              />
              <Text style={[styles.delta, improved ? null : styles.deltaDown]}>
                {healthScore.vsLast}
              </Text>
            </View>
          ) : (
            <Text style={styles.statLabel}>No comparison yet</Text>
          )}
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
  deltaDown: {
    color: colors.danger,
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

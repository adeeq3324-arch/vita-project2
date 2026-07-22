import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CircularGauge } from '@/components/charts/CircularGauge';
import { Card } from '@/components/ui/Card';
import { colors, fontWeight, radius, spacing, typography } from '@/theme';

import { HealthTrendChart } from './HealthTrendChart';
import { healthScoreFor } from './homeData';

/**
 * Hero card: the Health Score gauge on the left (score, /max, and 7-day
 * change), an "Excellent" badge top-right, and a weekly trend chart on the
 * right. Reflects the day selected in the week strip.
 */
export function HealthScoreCard({ date }: { date: Date }) {
  const healthScore = healthScoreFor(date);
  const positive = healthScore.delta >= 0;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Health Score</Text>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="star-four-points" size={13} color={colors.primary} />
          <Text style={styles.badgeText}>{healthScore.caption}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <CircularGauge value={healthScore.value} max={healthScore.max} size={116}>
          <View style={styles.gaugeCenter}>
            <Text style={styles.score}>{healthScore.value}</Text>
            <Text style={styles.scoreMax}>/ {healthScore.max}</Text>
            <Text style={[styles.delta, positive ? styles.deltaUp : styles.deltaDown]}>
              {positive ? '▲' : '▼'} {positive ? '+' : ''}
              {healthScore.delta}
            </Text>
            <Text style={styles.deltaLabel}>{healthScore.deltaLabel}</Text>
          </View>
        </CircularGauge>

        <View style={styles.chart}>
          <HealthTrendChart data={healthScore.trend} labels={healthScore.trendLabels} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
  },
  badgeText: {
    ...typography.micro,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gaugeCenter: {
    alignItems: 'center',
  },
  score: {
    ...typography.h2,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  scoreMax: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  delta: {
    ...typography.micro,
    fontWeight: fontWeight.semibold,
    marginTop: 3,
  },
  deltaUp: {
    color: colors.success,
  },
  deltaDown: {
    color: colors.danger,
  },
  deltaLabel: {
    ...typography.micro,
    fontSize: 9,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  chart: {
    flex: 1,
    marginLeft: spacing.base,
  },
});

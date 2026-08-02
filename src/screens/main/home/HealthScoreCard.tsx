import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CircularGauge } from '@/components/charts/CircularGauge';
import { Card } from '@/components/ui/Card';
import { colors, fontWeight, radius, spacing, typography } from '@/theme';

import type { HomeHealthScore } from '@/services/home/homeService';

import { HealthTrendChart } from './HealthTrendChart';

/**
 * Hero card: the Health Score gauge on the left (score, /max, and the change
 * over the trend window), a caption badge top-right, and the trend chart on the
 * right. Reflects the day selected in the week strip.
 *
 * The score is null until a day has enough logged to be scored, so a brand-new
 * account sees an explicit "—" rather than a zero it would read as a verdict.
 */
export function HealthScoreCard({ score }: { score: HomeHealthScore }) {
  const scored = score.value !== null;
  const positive = (score.delta ?? 0) >= 0;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Health Score</Text>
        {score.caption ? (
          <View style={styles.badge}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={colors.primary} />
            <Text style={styles.badgeText}>{score.caption}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <CircularGauge value={score.value ?? 0} max={score.max} size={116}>
          <View style={styles.gaugeCenter}>
            <Text style={styles.score}>{scored ? score.value : '—'}</Text>
            <Text style={styles.scoreMax}>/ {score.max}</Text>
            {score.delta !== null ? (
              <>
                <Text style={[styles.delta, positive ? styles.deltaUp : styles.deltaDown]}>
                  {positive ? '▲' : '▼'} {positive ? '+' : ''}
                  {score.delta}
                </Text>
                <Text style={styles.deltaLabel}>{score.deltaLabel}</Text>
              </>
            ) : (
              <Text style={styles.deltaLabel}>Not scored yet</Text>
            )}
          </View>
        </CircularGauge>

        <View style={styles.chart}>
          <HealthTrendChart
            data={score.trend.map((point) => point ?? 0)}
            labels={score.trendLabels}
          />
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

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

import { dailyMetricsFor, type Metric } from './homeData';

/**
 * Daily Health Overview: a three-column grid of metric tiles (calories,
 * protein, carbs, fat, water, steps), each with a mini progress bar. Reflects
 * the day selected in the week strip.
 */
export function OverviewGrid({ date }: { date: Date }) {
  const dailyMetrics = dailyMetricsFor(date);

  return (
    <View style={styles.grid}>
      {dailyMetrics.map((metric) => (
        <View key={metric.key} style={styles.cell}>
          <MetricTile metric={metric} />
        </View>
      ))}
    </View>
  );
}

function MetricTile({ metric }: { metric: Metric }) {
  const color = colors.metric[metric.metric];
  const surface = colors.metricSurface[metric.metric];

  return (
    <Card padding="sm" style={styles.tile}>
      <View style={styles.tileHeader}>
        <View style={[styles.icon, { backgroundColor: surface }]}>
          <MaterialCommunityIcons name={metric.icon} size={15} color={color} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {metric.label}
        </Text>
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {metric.value}
      </Text>
      <Text style={styles.target} numberOfLines={1}>
        {metric.target}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(metric.progress, 1) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    // Three equal columns accounting for two `spacing.sm` gutters.
    flexBasis: '31%',
    flexGrow: 1,
  },
  tile: {
    gap: 3,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.micro,
    color: colors.text.tertiary,
    flexShrink: 1,
  },
  value: {
    ...typography.h4,
    color: colors.text.primary,
  },
  target: {
    ...typography.micro,
    color: colors.text.disabled,
  },
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, layout, radius, spacing, typography } from '@/theme';

import { progressOverviewFor } from './homeData';

/**
 * Progress Overview: current weight with its monthly delta, goal-progress
 * percentage with a bar, and the active day streak. Reflects the day selected
 * in the week strip.
 */
export function ProgressOverviewCard({ date }: { date: Date }) {
  const { weight, goal, streak } = progressOverviewFor(date);

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Weight</Text>
          <Text style={styles.cellValue}>
            {weight.value}
            <Text style={styles.cellUnit}> {weight.unit}</Text>
          </Text>
          <View style={styles.deltaRow}>
            <Feather
              name="trending-down"
              size={13}
              color={weight.positive ? colors.success : colors.danger}
            />
            <Text style={[styles.delta, { color: weight.positive ? colors.success : colors.danger }]}>
              {weight.delta}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.cell}>
          <Text style={styles.cellLabel}>{goal.label}</Text>
          <Text style={styles.cellValue}>{goal.percent}%</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${goal.percent}%` }]} />
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.cell}>
          <Text style={styles.cellLabel}>{streak.label}</Text>
          <View style={styles.streakRow}>
            <MaterialFlame />
            <Text style={styles.cellValue}>{streak.value}</Text>
          </View>
          <Text style={styles.cellHint}>days in a row</Text>
        </View>
      </View>
    </Card>
  );
}

function MaterialFlame() {
  return <Feather name="zap" size={18} color={colors.warning} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  separator: {
    width: layout.hairline,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.sm,
  },
  cellLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  cellValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  cellUnit: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  cellHint: {
    ...typography.micro,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xs,
  },
  delta: {
    ...typography.micro,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  track: {
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});

import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, layout, radius, spacing, typography } from '@/theme';

import type { HomeProgress } from '@/services/home/homeService';

/**
 * Progress Overview: current weight with its change since the start of the
 * window, goal-progress percentage with a bar, and the active day streak.
 *
 * Every figure can legitimately be unknown — no weigh-in recorded, no target
 * set — so each cell falls back to "—" rather than presenting a zero as a
 * measurement.
 */
export function ProgressOverviewCard({ progress }: { progress: HomeProgress }) {
  const { weight, goal, streak } = progress;
  const percent = goal.percent ?? 0;
  const delta = weight.delta;

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Weight</Text>
          <Text style={styles.cellValue}>
            {weight.current ?? '—'}
            {weight.current !== null ? <Text style={styles.cellUnit}> {weight.unit}</Text> : null}
          </Text>
          {delta !== null && delta !== 0 ? (
            <View style={styles.deltaRow}>
              <Feather
                name={delta < 0 ? 'trending-down' : 'trending-up'}
                size={13}
                color={weight.positive ? colors.success : colors.danger}
              />
              <Text
                style={[styles.delta, { color: weight.positive ? colors.success : colors.danger }]}
              >
                {delta > 0 ? '+' : ''}
                {delta} {weight.unit}
              </Text>
            </View>
          ) : (
            <Text style={styles.cellHint}>
              {weight.current === null ? 'No weigh-in yet' : 'No change yet'}
            </Text>
          )}
        </View>

        <View style={styles.separator} />

        <View style={styles.cell}>
          <Text style={styles.cellLabel}>{goal.label}</Text>
          <Text style={styles.cellValue}>{goal.percent === null ? '—' : `${percent}%`}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
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

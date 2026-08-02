import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { colors, layout, spacing, typography } from '@/theme';

export type WeekSummary = {
  /** Meals across the whole generated week, not per day. */
  mealsPlanned: number;
  supplements: number;
};

/** "This Week Summary": planned meals and supplements at a glance. */
export function WeekSummaryCard({ summary }: { summary: WeekSummary }) {
  const cells = [
    { value: summary.mealsPlanned, label: 'Meals Planned' },
    { value: summary.supplements, label: 'Supplements' },
  ];
  return (
    <Card>
      <View style={styles.row}>
        {cells.map((cell, index) => (
          <View key={cell.label} style={styles.cellWrap}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <View style={styles.cell}>
              <Text style={styles.value}>{cell.value}</Text>
              <Text style={styles.label}>{cell.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cellWrap: { flex: 1, flexDirection: 'row' },
  separator: {
    width: layout.hairline,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.sm,
  },
  cell: { flex: 1, alignItems: 'center' },
  value: {
    ...typography.h1,
    color: colors.text.primary,
  },
  label: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});

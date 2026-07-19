import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, layout, spacing, typography } from '@/theme';

export type Stat = {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * Row of equal-width stats separated by hairlines — reused for body
 * measurements and fitness totals across the Progress cards.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={styles.cellWrap}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <View style={styles.cell}>
            {stat.icon ? (
              <MaterialCommunityIcons
                name={stat.icon}
                size={16}
                color={colors.primary}
                style={styles.icon}
              />
            ) : null}
            <Text style={styles.value} numberOfLines={1}>
              {stat.value}
              {stat.unit ? <Text style={styles.unit}> {stat.unit}</Text> : null}
            </Text>
            <Text style={styles.label} numberOfLines={1}>
              {stat.label}
            </Text>
            {stat.hint ? (
              <Text style={styles.hint} numberOfLines={1}>
                {stat.hint}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cellWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  separator: {
    width: layout.hairline,
    backgroundColor: colors.divider,
    marginRight: spacing.sm,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  icon: {
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.h4,
    color: colors.text.primary,
  },
  unit: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
  label: {
    ...typography.micro,
    color: colors.text.secondary,
    marginTop: 2,
  },
  hint: {
    ...typography.micro,
    color: colors.text.disabled,
    marginTop: 1,
  },
});

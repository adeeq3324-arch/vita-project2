import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type ListRowProps = {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  /** Trailing value text (e.g. "English", "Metric"). */
  value?: string;
  onPress?: () => void;
  /** Custom trailing element (e.g. a Switch); replaces value/chevron. */
  right?: React.ReactNode;
  /** Hide the trailing chevron even when pressable. */
  hideChevron?: boolean;
  danger?: boolean;
};

/** Settings/profile list row: leading icon tile, label, trailing value or control. */
export function ListRow({ icon, label, value, onPress, right, hideChevron, danger }: ListRowProps) {
  const color = danger ? colors.danger : colors.text.primary;

  const content = (
    <>
      {icon ? (
        <View style={[styles.iconTile, danger && styles.iconTileDanger]}>
          <MaterialCommunityIcons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
      {right ?? (
        <>
          {value ? <Text style={styles.value}>{value}</Text> : null}
          {onPress && !hideChevron ? (
            <Feather name="chevron-right" size={18} color={colors.text.disabled} />
          ) : null}
        </>
      )}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  pressed: {
    opacity: 0.6,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileDanger: {
    backgroundColor: colors.dangerSurface,
  },
  label: {
    flex: 1,
    ...typography.body,
  },
  value: {
    ...typography.body,
    color: colors.text.tertiary,
  },
});

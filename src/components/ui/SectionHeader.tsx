import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type SectionHeaderProps = {
  title: string;
  /** Optional trailing text: an action link ("Edit") or a status ("4/5 Completed"). */
  action?: string;
  /** When set, the action reads as a tappable link; otherwise it's muted status text. */
  onActionPress?: () => void;
};

/**
 * Row pairing a section title with an optional trailing action or status,
 * used above each block on the Home screen.
 */
export function SectionHeader({ title, action, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action != null &&
        (onActionPress ? (
          <Pressable onPress={onActionPress} accessibilityRole="button" hitSlop={spacing.sm}>
            <Text style={styles.link}>{action}</Text>
          </Pressable>
        ) : (
          <Text style={styles.status}>{action}</Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  link: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  status: {
    ...typography.label,
    color: colors.text.tertiary,
  },
});

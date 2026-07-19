import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { BackButton } from './BackButton';

/**
 * Back-chevron + centred title bar for pushed screens (plan details, scanner
 * results, settings). An optional trailing slot keeps the title centred.
 */
export function DetailHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <BackButton />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  side: {
    width: 44,
    justifyContent: 'center',
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
});

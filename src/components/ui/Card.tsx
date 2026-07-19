import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { colors, layout, radius, shadows } from '@/theme';

type CardProps = ViewProps & {
  /** Padding preset. `none` when the card manages its own insets. */
  padding?: 'none' | 'sm' | 'base';
  style?: ViewStyle;
};

/**
 * White rounded surface lifted off the background with the design's soft
 * shadow — the base container for every panel on the Home screen.
 */
export function Card({ padding = 'base', style, children, ...rest }: CardProps) {
  return (
    <View style={[styles.card, padding !== 'none' && paddingStyle[padding], style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
});

const paddingStyle = StyleSheet.create({
  sm: { padding: 12 },
  base: { padding: layout.cardPadding },
});

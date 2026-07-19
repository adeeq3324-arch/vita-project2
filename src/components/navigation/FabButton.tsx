import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { colors, layout, radius, shadows } from '@/theme';

/**
 * Central floating action button that sits between the two tab pairs, lifted
 * above the bar. Opens the quick-action menu (built in a later task); for now
 * the press is a no-op.
 */
export function FabButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Quick actions"
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <Feather name="plus" size={28} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  pressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.94 }],
  },
});

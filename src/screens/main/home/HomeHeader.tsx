import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';

type HomeHeaderProps = {
  name: string;
  onProfilePress: () => void;
  onNotificationsPress: () => void;
};

/**
 * Home top bar: tappable avatar + greeting on the left, notification bell on
 * the right. The avatar opens Profile (which is not a tab).
 */
export function HomeHeader({ name, onProfilePress, onNotificationsPress }: HomeHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onProfilePress}
        accessibilityRole="button"
        accessibilityLabel="Open your profile"
        style={styles.identity}
        hitSlop={spacing.xs}
      >
        <Avatar name={name} size={44} />
        <View style={styles.greeting}>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {name} <Text style={styles.wave}>👋</Text>
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onNotificationsPress}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}
        hitSlop={spacing.sm}
      >
        <Feather name="bell" size={20} color={colors.text.secondary} />
        <View style={styles.badge} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  greeting: {
    flexShrink: 1,
  },
  welcome: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  name: {
    ...typography.h3,
    color: colors.text.primary,
  },
  wave: {
    fontSize: 16,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.xs,
  },
  bellPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  badge: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    borderWidth: layout.hairline,
    borderColor: colors.surface,
  },
});

import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

/**
 * The three states every data-backed screen shows besides its content: loading,
 * failed, and nothing-here-yet.
 *
 * They are one module because they must look and behave identically everywhere —
 * a screen that invents its own spinner or swallows an error is how an app ends
 * up feeling unfinished in exactly the places a user notices.
 */

/** Centred spinner for a first load, before any content exists. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

/**
 * A failed read, with the reason and a way to try again. The message comes from
 * the API client, which already turns transport failures into something a user
 * can act on ("Cannot reach the VITAL AI server…").
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Feather name="alert-circle" size={22} color={colors.danger} />
      </View>
      <Text style={styles.title}>Couldn’t load this</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Feather name="refresh-cw" size={15} color={colors.white} />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A successful read with nothing in it — a new account, or a day with no
 * entries. Distinct from an error on purpose: there is nothing wrong, and the
 * copy should say what to do rather than what failed.
 */
export function EmptyState({
  icon = 'inbox',
  title,
  message,
  action,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, styles.iconWrapNeutral]}>
        <Feather name={icon} size={22} color={colors.text.tertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Text style={styles.retryText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSurface,
    marginBottom: spacing.xxs,
  },
  iconWrapNeutral: {
    backgroundColor: colors.surfaceSunken,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.text.primary,
    textAlign: 'center',
  },
  message: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  caption: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.base,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  retryPressed: {
    backgroundColor: colors.primaryDark,
  },
  retryText: {
    ...typography.label,
    color: colors.white,
  },
});

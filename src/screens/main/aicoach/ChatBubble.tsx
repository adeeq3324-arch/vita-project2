import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type ChatRole = 'ai' | 'user';

/** A single chat bubble: AI on the left (light), user on the right (violet). */
export function ChatBubble({ role, text }: { role: ChatRole; text: string }) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.ai]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>{text}</Text>
      </View>
    </View>
  );
}

/** Three-dot "typing" bubble shown while the assistant composes a reply. */
export function TypingBubble() {
  return (
    <View style={[styles.row, styles.rowAi]}>
      <View style={[styles.bubble, styles.ai, styles.typing]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotMid]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  rowAi: {
    justifyContent: 'flex-start',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  ai: {
    backgroundColor: colors.surfaceSunken,
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  user: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.xs,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  text: {
    ...typography.body,
    lineHeight: 21,
  },
  aiText: {
    color: colors.text.primary,
  },
  userText: {
    color: colors.white,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.base,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: colors.text.disabled,
  },
  dotMid: {
    opacity: 0.6,
  },
});

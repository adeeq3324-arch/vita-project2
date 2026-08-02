import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type ChatRole = 'ai' | 'user';

/**
 * Emphasis the coach occasionally writes despite being told not to.
 *
 * The prompt asks for plain text, because this bubble is a `Text` and markdown
 * has no meaning inside one. A model still reaches for `**bold**` now and then,
 * and asterisks printed literally look like a bug — so the few that get through
 * are rendered rather than shown. Split on the delimiter and every other piece
 * is the emphasised one.
 */
const EMPHASIS = /\*\*/;

/** A single chat bubble: AI on the left (light), user on the right (violet). */
export function ChatBubble({ role, text }: { role: ChatRole; text: string }) {
  const isUser = role === 'user';
  const parts = text.split(EMPHASIS);

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.ai]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
          {parts.map((part, index) =>
            index % 2 === 1 ? (
              <Text key={index} style={styles.strong}>
                {part}
              </Text>
            ) : (
              part
            ),
          )}
        </Text>
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
    // The coach answers in the user's own language, so a bubble may hold Arabic
    // or another right-to-left script inside a left-to-right interface. `auto`
    // lets each message take its direction from its own text.
    writingDirection: 'auto',
  },
  strong: {
    ...typography.bodyStrong,
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

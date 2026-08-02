import { Feather } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Waveform } from '@/components/ai/Waveform';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { useOnboarding } from '@/context/OnboardingContext';
import { useVoiceRecorder } from '@/hooks';
import { coachService } from '@/services';
import { ApiError } from '@/services/api/client';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { ChatBubble, TypingBubble, type ChatRole } from './aicoach/ChatBubble';
import { greeting, suggestions } from './aicoach/starters';

/**
 * The AI Health Coach.
 *
 * A conversation with the model, held on the server: it knows the user's age,
 * weight, activity level, declared conditions, goal and daily targets, it
 * answers in whatever language it is spoken to, and it hands meal and supplement
 * plans over to the Planning tab rather than improvising ones that compete with
 * the plan the user already follows.
 *
 * The reply streams. Everything about the state below follows from that: an
 * answer is on screen before it is finished, it can fail halfway through, and
 * the user has to be able to stop it — none of which a request/response screen
 * has to think about.
 */

type Props = BottomTabScreenProps<MainTabParamList, 'AiCoach'>;

type Message = { id: string; role: ChatRole; text: string };

/** The words that make the coach's handover to the Planning tab tappable. */
const PLANNING_MENTION = /planning/i;

export function AICoachScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const scrollRef = useRef<ScrollView>(null);
  const voice = useVoiceRecorder();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Bumped to re-run the thread read after a failure. */
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  /** The reply being streamed. Null when the coach is not answering. */
  const [streaming, setStreaming] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  /** A failure that does not cost the thread — shown as a dismissible line. */
  const [notice, setNotice] = useState<string | null>(null);

  /** Cancels the reply in flight, if there is one. */
  const cancelStream = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  const starters = suggestions(data);
  const isEmpty = messages.length === 0;
  const busy = streaming !== null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelStream.current?.();
    };
  }, []);

  /**
   * Opens the thread the user was last in, or starts one.
   *
   * History is read from the server rather than kept in memory, so the coach
   * still remembers the conversation after the app is closed — which is most of
   * what makes it feel like a coach and not a search box.
   *
   * Retrying bumps `attempt` rather than calling a loader: the read has to be
   * the effect itself so it can be abandoned when the screen goes away
   * mid-flight, and a counter is what lets a button re-run one.
   */
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const conversation = await coachService.currentConversation();
        const history = await coachService.listMessages(conversation.id);
        if (!active) return;

        setConversationId(conversation.id);
        setMessages(
          history.map((message) => ({
            id: message.id,
            role: message.role === 'user' ? 'user' : 'ai',
            text: message.content,
          })),
        );
      } catch (error) {
        if (!active) return;
        setLoadError(
          error instanceof ApiError ? error.message : 'The coach could not be reached.',
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [attempt]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setAttempt((n) => n + 1);
  }, []);

  // Keep the newest message in view as it grows, token by token.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages, streaming]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || !conversationId || busy) return;

      setInput('');
      setNotice(null);
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
      setStreaming('');

      let answer = '';

      cancelStream.current = coachService.streamReply(conversationId, text, {
        onChunk: (chunk) => {
          if (!mounted.current) return;
          answer += chunk;
          setStreaming(answer);
        },
        onDone: ({ id, content }) => {
          if (!mounted.current) return;
          cancelStream.current = null;
          setStreaming(null);
          setMessages((prev) => [...prev, { id, role: 'ai', text: content }]);
        },
        onError: (message) => {
          if (!mounted.current) return;
          cancelStream.current = null;
          // Whatever arrived before the failure is kept: a half answer the user
          // has already read is worth more than a bubble that vanishes.
          setMessages((prev) =>
            answer.trim().length > 0
              ? [...prev, { id: `a-${Date.now()}`, role: 'ai', text: answer.trim() }]
              : prev,
          );
          setStreaming(null);
          setNotice(message);
        },
      });
    },
    [busy, conversationId],
  );

  /** Stops the reply where it is and keeps what has arrived so far. */
  const stopReply = useCallback(() => {
    cancelStream.current?.();
    cancelStream.current = null;
    setMessages((prev) =>
      streaming && streaming.trim().length > 0
        ? [...prev, { id: `a-${Date.now()}`, role: 'ai', text: streaming.trim() }]
        : prev,
    );
    setStreaming(null);
  }, [streaming]);

  /**
   * Records a question and puts what was heard in the composer.
   *
   * Deliberately not sent straight away: speech recognition mishears names and
   * numbers, and a wrong word sent unseen gets a confident answer to a question
   * nobody asked. The user reads it, fixes it if needed, and sends.
   */
  const toggleVoice = useCallback(async () => {
    if (transcribing || busy) return;

    if (!voice.isRecording) {
      setNotice(null);
      await voice.start();
      return;
    }

    const recording = await voice.stop();
    if (!recording) return;

    setTranscribing(true);
    try {
      const text = await coachService.transcribe(recording);
      if (!mounted.current) return;
      setInput((current) => (current.trim().length > 0 ? `${current.trim()} ${text}` : text));
    } catch (error) {
      if (!mounted.current) return;
      setNotice(
        error instanceof ApiError ? error.message : 'That recording could not be understood.',
      );
    } finally {
      if (mounted.current) setTranscribing(false);
    }
  }, [busy, transcribing, voice]);

  const openProfile = () =>
    navigation.getParent<NativeStackNavigationProp<MainStackParamList>>()?.navigate('Profile');

  const openPlanning = () => navigation.navigate('Planning');

  const micLabel = voice.isRecording
    ? 'Listening… tap to stop'
    : transcribing
      ? 'Writing down what you said…'
      : 'Tap to speak — any language';

  const lastMessage = messages[messages.length - 1];
  const showPlanningShortcut =
    !busy && lastMessage?.role === 'ai' && PLANNING_MENTION.test(lastMessage.text);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.identity} onPress={openProfile} accessibilityLabel="Open your profile">
          <Avatar name={data.username || 'AI'} size={38} />
          <Text style={styles.headerTitle}>AI Coach</Text>
        </Pressable>
        <Pressable
          onPress={openPlanning}
          accessibilityRole="button"
          accessibilityLabel="Open your plans"
          style={({ pressed }) => [styles.badge, pressed && styles.badgePressed]}
        >
          <Feather name="calendar" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {conversationId === null ? (
          loadError ? (
            <ErrorState message={loadError} onRetry={retryLoad} />
          ) : (
            <LoadingState label="Waking your coach…" />
          )
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.messages}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {isEmpty ? <ChatBubble role="ai" text={greeting(data)} /> : null}

              {messages.map((message) => (
                <ChatBubble key={message.id} role={message.role} text={message.text} />
              ))}

              {streaming !== null ? (
                streaming.length > 0 ? (
                  <ChatBubble role="ai" text={streaming} />
                ) : (
                  <TypingBubble />
                )
              ) : null}

              {showPlanningShortcut ? (
                <Pressable
                  onPress={openPlanning}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.planCta, pressed && styles.planCtaPressed]}
                >
                  <Feather name="calendar" size={15} color={colors.white} />
                  <Text style={styles.planCtaText}>Open Planning</Text>
                </Pressable>
              ) : null}

              {isEmpty && !busy ? (
                <View style={styles.suggestions}>
                  {starters.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => send(suggestion)}
                      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    >
                      <Text style={styles.chipText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {notice ?? voice.error ? (
              <Pressable
                style={styles.notice}
                onPress={() => setNotice(null)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={styles.noticeText}>{notice ?? voice.error}</Text>
              </Pressable>
            ) : null}

            <View
              style={[
                styles.footer,
                { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.sm },
              ]}
            >
              <View style={styles.voicePanel}>
                <Text style={styles.voiceLabel}>{micLabel}</Text>
                <View style={styles.voiceRow}>
                  <View style={styles.flex}>
                    <Waveform active={voice.isRecording} />
                  </View>
                  <Pressable
                    onPress={() => void toggleVoice()}
                    disabled={transcribing || busy}
                    accessibilityRole="button"
                    accessibilityLabel={
                      voice.isRecording ? 'Stop recording' : 'Ask your question out loud'
                    }
                    style={({ pressed }) => [
                      styles.mic,
                      voice.isRecording && styles.micActive,
                      (transcribing || busy) && styles.micDisabled,
                      pressed && styles.micPressed,
                    ]}
                  >
                    {transcribing ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Feather
                        name={voice.isRecording ? 'square' : 'mic'}
                        size={22}
                        color={colors.white}
                      />
                    )}
                  </Pressable>
                  <View style={styles.flex}>
                    <Waveform active={voice.isRecording} />
                  </View>
                </View>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type your message…"
                  placeholderTextColor={colors.text.disabled}
                  style={styles.input}
                  onSubmitEditing={() => send(input)}
                  editable={!busy}
                  multiline
                  returnKeyType="send"
                />
                {busy ? (
                  <Pressable
                    onPress={stopReply}
                    accessibilityRole="button"
                    accessibilityLabel="Stop the reply"
                    style={({ pressed }) => [styles.send, styles.stop, pressed && styles.sendPressed]}
                  >
                    <Feather name="square" size={16} color={colors.white} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => send(input)}
                    disabled={!input.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    style={({ pressed }) => [
                      styles.send,
                      !input.trim() && styles.sendDisabled,
                      pressed && input.trim() && styles.sendPressed,
                    ]}
                  >
                    <Feather name="send" size={18} color={colors.white} />
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.divider,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePressed: {
    backgroundColor: colors.primarySubtle,
  },
  messages: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.base,
  },
  suggestions: {
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: layout.hairline,
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  chipPressed: {
    backgroundColor: colors.primarySurface,
  },
  chipText: {
    ...typography.label,
    color: colors.primary,
  },
  planCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.base,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  planCtaPressed: {
    backgroundColor: colors.primaryDark,
  },
  planCtaText: {
    ...typography.label,
    color: colors.white,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  noticeText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  voicePanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    ...shadows.xs,
  },
  voiceLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mic: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primary,
  },
  micActive: {
    backgroundColor: colors.danger,
  },
  micDisabled: {
    backgroundColor: colors.primaryLight,
  },
  micPressed: {
    transform: [{ scale: 0.94 }],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.lg,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stop: {
    backgroundColor: colors.danger,
  },
  sendDisabled: {
    backgroundColor: colors.primaryLight,
  },
  sendPressed: {
    backgroundColor: colors.primaryDark,
  },
});

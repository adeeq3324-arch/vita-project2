import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
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
import { useOnboarding } from '@/context/OnboardingContext';
import { coachGreeting, coachReply, coachSuggestions } from '@/services/ai';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { ChatBubble, TypingBubble, type ChatRole } from './aicoach/ChatBubble';

type Props = BottomTabScreenProps<MainTabParamList, 'AiCoach'>;
type Message = { id: string; role: ChatRole; text: string };

export function AICoachScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id: 'greeting', role: 'ai', text: coachGreeting(data) },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);

  const suggestions = coachSuggestions(data);
  const showSuggestions = messages.length === 1 && !typing;

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages, typing]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ai', text: coachReply(text, data) }]);
      setTyping(false);
    }, 750);
  };

  const startVoice = () => {
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    // Simulate live speech-to-text: capture a spoken question, then reply.
    setTimeout(() => {
      setListening(false);
      send(suggestions[0]!);
    }, 1700);
  };

  const openProfile = () =>
    navigation.getParent<NativeStackNavigationProp<MainStackParamList>>()?.navigate('Profile');

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.identity} onPress={openProfile} accessibilityLabel="Open your profile">
          <Avatar name={data.username || 'AI'} size={38} />
          <Text style={styles.headerTitle}>AI Coach</Text>
        </Pressable>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="robot-happy" size={18} color={colors.primary} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <ChatBubble key={message.id} role={message.role} text={message.text} />
          ))}
          {typing ? <TypingBubble /> : null}

          {showSuggestions ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
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

        <View style={[styles.footer, { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.sm }]}>
          <View style={styles.voicePanel}>
            <Text style={styles.voiceLabel}>{listening ? 'Listening…' : 'Tap to speak'}</Text>
            <View style={styles.voiceRow}>
              <View style={styles.flex}>
                <Waveform active={listening} />
              </View>
              <Pressable
                onPress={startVoice}
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Stop listening' : 'Start voice input'}
                style={({ pressed }) => [
                  styles.mic,
                  listening && styles.micActive,
                  pressed && styles.micPressed,
                ]}
              >
                <Feather name={listening ? 'square' : 'mic'} size={22} color={colors.white} />
              </Pressable>
              <View style={styles.flex}>
                <Waveform active={listening} />
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
              returnKeyType="send"
            />
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
          </View>
        </View>
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
  micPressed: {
    transform: [{ scale: 0.94 }],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.full,
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: colors.primaryLight,
  },
  sendPressed: {
    backgroundColor: colors.primaryDark,
  },
});

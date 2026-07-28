import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { ApiError, authService } from '@/services';
import { colors, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ForgotPassword'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const showError = email.length > 0 && !emailValid;

  const handleSend = async () => {
    if (sent) {
      navigation.goBack();
      return;
    }
    if (!emailValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not send the reset link. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <BackButton />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.heading}>Reset your password</Text>
          <Text style={styles.subheading}>
            {sent
              ? "If an account exists for this email, we've sent a link to reset your password."
              : 'Enter your email and we’ll send you a link to reset your password'}
          </Text>

          {!sent ? (
            <View style={styles.form}>
              <Field label="Email">
                <Input
                  icon="mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="done"
                />
                {showError ? (
                  <Text style={styles.error}>Enter a valid email address</Text>
                ) : null}
              </Field>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Button
          label={sent ? 'Back to sign up' : submitting ? 'Sending…' : 'Send reset link'}
          disabled={(!sent && !emailValid) || submitting}
          onPress={handleSend}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heading: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subheading: {
    ...typography.body,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.base,
    marginTop: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  footer: {
    gap: spacing.base,
  },
});

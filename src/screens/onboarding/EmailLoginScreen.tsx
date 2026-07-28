import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useOnboarding } from '@/context/OnboardingContext';
import { ApiError, authService } from '@/services';
import { colors, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'EmailLogin'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailLoginScreen({ navigation }: Props) {
  const { reset: resetOnboarding } = useOnboarding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const passwordValid = password.length > 0;
  const canSubmit = emailValid && passwordValid && !submitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await authService.login(email.trim(), password);

      if (result.emailConfirmationRequired) {
        // Account exists but is unverified — the backend won't issue a session
        // until the email is confirmed.
        setSubmitError('Please confirm your email address, then log in again.');
        return;
      }

      // Existing account — onboarding already lives on the server, so drop any
      // in-memory onboarding state and enter the app.
      resetOnboarding();
      navigation.getParent()?.navigate('Main');
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not log you in. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Only surface the email error once the user has typed something.
  const errors = useMemo(
    () => ({
      email: email.length > 0 && !emailValid ? 'Enter a valid email address' : undefined,
    }),
    [email, emailValid],
  );

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
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>
            Log in with your email and password to access your plan
          </Text>

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
                returnKeyType="next"
              />
              {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
            </Field>

            <Field label="Password">
              <Input
                icon="lock"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </Field>

            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        <Button
          label={submitting ? 'Logging in…' : 'Log In'}
          disabled={!canSubmit}
          accessibilityHint="Enter your email and password to log in"
          onPress={handleLogin}
        />

        <Pressable
          onPress={() => navigation.navigate('Auth')}
          accessibilityRole="link"
          accessibilityLabel="Don't have an account? Sign up"
          style={styles.switchRow}
          hitSlop={spacing.sm}
        >
          <Text style={styles.switchText}>
            Don’t have an account? <Text style={styles.switchLink}>Sign up</Text>
          </Text>
        </Pressable>
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
  submitError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  forgot: {
    alignSelf: 'flex-start',
  },
  forgotText: {
    ...typography.label,
    color: colors.primary,
  },
  footer: {
    gap: spacing.base,
  },
  switchRow: {
    alignItems: 'center',
  },
  switchText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  switchLink: {
    ...typography.label,
    color: colors.primary,
  },
});

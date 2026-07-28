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
import { ApiError, authService, onboardingService } from '@/services';
import { colors, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'EmailSignUp'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function EmailSignUpScreen({ navigation }: Props) {
  const { data: onboarding, reset: resetOnboarding } = useOnboarding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSubmit = emailValid && passwordValid && passwordsMatch && !submitting;

  const handleCreateAccount = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1) Create the account. With email confirmation disabled, this returns a
      //    session and the user is now authenticated.
      const result = await authService.signUp(email.trim(), password);

      if (result.emailConfirmationRequired) {
        // No session yet — the account exists but must be verified first.
        setSubmitError(
          'Account created. Please confirm your email, then log in to finish setup.',
        );
        return;
      }

      // 2) Persist the onboarding data collected in the previous steps.
      await onboardingService.submitOnboarding(onboarding);

      // 3) Done — clear the in-memory onboarding state and enter the app.
      resetOnboarding();
      navigation.getParent()?.navigate('Main');
    } catch (error) {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Only surface each error once the user has typed something, so the form
  // doesn't shout on first render.
  const errors = useMemo(
    () => ({
      email: email.length > 0 && !emailValid ? 'Enter a valid email address' : undefined,
      password:
        password.length > 0 && !passwordValid
          ? `Use at least ${MIN_PASSWORD_LENGTH} characters`
          : undefined,
      confirm:
        confirm.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined,
    }),
    [email, password, confirm, emailValid, passwordValid, passwordsMatch],
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
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>
            Sign up with your email and a password to save your plan
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
                placeholder="Create a password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="next"
              />
              {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
            </Field>

            <Field label="Confirm Password">
              <Input
                icon="lock"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter your password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
              />
              {errors.confirm ? <Text style={styles.error}>{errors.confirm}</Text> : null}
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
          label={submitting ? 'Creating account…' : 'Create Account'}
          disabled={!canSubmit}
          accessibilityHint="Enter a valid email and matching passwords to continue"
          onPress={handleCreateAccount}
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
});

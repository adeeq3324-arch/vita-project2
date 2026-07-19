import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { VitalLogo } from '@/components/brand/VitalLogo';
import { VitalWordmark } from '@/components/brand/VitalWordmark';
import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { SocialButton, type SocialProvider } from '@/components/auth/SocialButton';
import { colors, fontSize, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Auth'>;

// Order follows the design brief: Google, Apple, Facebook.
const providers: SocialProvider[] = ['google', 'apple', 'facebook'];

export function AuthScreen({ navigation }: Props) {
  // UI only — any provider drops the user into the app for now. Real auth and
  // the choice of where to route (existing vs new account) land with the backend.
  const handleContinue = (_provider: SocialProvider) => {
    navigation.getParent()?.navigate('Main');
  };

  return (
    <Screen>
      <BackButton />

      <View style={styles.hero}>
        <VitalLogo size={92} />
        <VitalWordmark />
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.subtitle}>
          Save your personalized plan and{'\n'}sync it across your devices
        </Text>
      </View>

      <View style={styles.actions}>
        {providers.map((provider) => (
          <SocialButton
            key={provider}
            provider={provider}
            onPress={() => handleContinue(provider)}
          />
        ))}

        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms of Service</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  terms: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  link: {
    ...typography.label,
    color: colors.primary,
  },
});

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VitalLogo } from '@/components/brand/VitalLogo';
import { VitalWordmark } from '@/components/brand/VitalWordmark';
import { Screen } from '@/components/layout/Screen';
import { FeatureRow } from '@/components/onboarding/FeatureRow';
import { Button } from '@/components/ui/Button';
import { colors, fontSize, spacing, typography } from '@/theme';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const features = [
  {
    icon: 'clipboard-text-outline',
    accent: 'violet',
    title: 'Personalized plans',
    subtitle: 'tailored to your goals',
  },
  {
    icon: 'brain',
    accent: 'cyan',
    title: 'AI powered insights',
    subtitle: 'for better results',
  },
  {
    icon: 'heart-pulse',
    accent: 'orange',
    title: 'Track progress',
    subtitle: 'and stay motivated',
  },
] as const;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.hero}>
        <VitalLogo size={140} />

        <Text style={styles.welcomeTo}>Welcome to</Text>
        <VitalWordmark />
        <Text style={styles.tagline}>Your AI Health &{'\n'}Fitness Companion</Text>

        <View style={styles.features}>
          {features.map((feature) => (
            <FeatureRow key={feature.title} {...feature} />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Get Started" onPress={() => navigation.navigate('GoalSelection')} />

        <Pressable
          onPress={() => navigation.navigate('EmailLogin')}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Log in"
          style={styles.loginRow}
          hitSlop={spacing.sm}
        >
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </Pressable>
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
  welcomeTo: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  tagline: {
    fontSize: fontSize.lg,
    lineHeight: 26,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  features: {
    alignSelf: 'stretch',
    gap: spacing.base,
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.md,
  },
  footer: {
    gap: spacing.base,
  },
  loginRow: {
    alignItems: 'center',
  },
  loginText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  loginLink: {
    ...typography.label,
    color: colors.primary,
  },
});

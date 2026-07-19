import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { StepDots } from '@/components/onboarding/StepDots';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors, spacing, typography } from '@/theme';
import type { ActivityLevel, Gender } from '@/types';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'UserInformation'>;

const genderOptions: readonly SelectOption<Gender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const activityOptions: readonly SelectOption<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Sedentary — little or no exercise' },
  { value: 'lightly_active', label: 'Lightly Active — 1–3 days a week' },
  { value: 'moderately_active', label: 'Moderately Active — 3–5 days a week' },
  { value: 'very_active', label: 'Very Active — 6–7 days a week' },
  { value: 'extremely_active', label: 'Extremely Active — physical job or twice daily' },
];

export function UserInformationScreen({ navigation }: Props) {
  const { data, setField, setGender, setActivityLevel, isProfileComplete } = useOnboarding();

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
          <Text style={styles.heading}>Tell us about{'\n'}yourself</Text>
          <Text style={styles.subheading}>We&rsquo;ll personalize everything for you</Text>

          <View style={styles.form}>
            <Field label="Username">
              <Input
                icon="user"
                value={data.username}
                onChangeText={(value) => setField('username', value)}
                placeholder="Enter your username"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
              />
            </Field>

            <View style={styles.row}>
              <Field label="Age" style={styles.flex}>
                <Input
                  icon="calendar"
                  value={data.age}
                  onChangeText={(value) => setField('age', value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter age"
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </Field>

              <Field label="Gender" style={styles.flex}>
                <Select
                  title="Gender"
                  value={data.gender}
                  options={genderOptions}
                  placeholder="Select gender"
                  onChange={setGender}
                />
              </Field>
            </View>

            <View style={styles.row}>
              <Field label="Height" style={styles.flex}>
                <Input
                  icon="bar-chart-2"
                  value={data.height}
                  onChangeText={(value) => setField('height', value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter height (cm)"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </Field>

              <Field label="Weight" style={styles.flex}>
                <Input
                  icon="trending-down"
                  value={data.weight}
                  onChangeText={(value) => setField('weight', value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter weight (kg)"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
              </Field>
            </View>

            <Field label="Activity Level">
              <Select
                title="Activity Level"
                value={data.activityLevel}
                options={activityOptions}
                placeholder="Select your activity level"
                onChange={setActivityLevel}
              />
            </Field>

            <Field label="Target Weight">
              <Input
                icon="target"
                value={data.targetWeight}
                onChangeText={(value) => setField('targetWeight', value.replace(/[^0-9.]/g, ''))}
                placeholder="Enter target weight (kg)"
                keyboardType="decimal-pad"
                maxLength={5}
              />
            </Field>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          label="Complete Setup"
          disabled={!isProfileComplete}
          accessibilityHint="Fill in every field to continue"
          onPress={() => {
            // Last data step done — hand off to the account screen (screen 5).
            // Onboarding data is already in context, ready for it.
            navigation.navigate('Auth');
          }}
        />
        <StepDots currentStep={4} />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footer: {
    gap: spacing.base,
  },
});

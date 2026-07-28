import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { activityOptions, genderOptions, profileLimits } from '@/constants/profileOptions';
import { useOnboarding, type OnboardingData } from '@/context/OnboardingContext';
import { ApiError, profileService } from '@/services';
import { colors, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

/** Everything on this screen; goal and conditions have their own editors. */
type Draft = Omit<OnboardingData, 'goal' | 'conditions'>;

type Range = { min: number; max: number };

/**
 * Validates one numeric field against the backend's accepted range. Returns
 * `undefined` when the value is fine.
 */
function numberError(value: string, label: string, { min, max }: Range): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required`;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return `Enter a valid ${label.toLowerCase()}`;
  if (parsed < min || parsed > max) return `${label} must be between ${min} and ${max}`;
  return undefined;
}

/**
 * Edits the personal details captured during onboarding. Changes are held in a
 * local draft and only written to the profile on save, so backing out with the
 * header chevron discards them.
 */
export function EditProfileScreen({ navigation }: Props) {
  const { data, update } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    username: data.username,
    age: data.age,
    gender: data.gender,
    height: data.height,
    weight: data.weight,
    activityLevel: data.activityLevel,
    targetWeight: data.targetWeight,
  });

  const setDraftField = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const errors = useMemo(
    () => ({
      username: draft.username.trim() ? undefined : 'Username is required',
      age: numberError(draft.age, 'Age', profileLimits.age),
      gender: draft.gender ? undefined : 'Gender is required',
      height: numberError(draft.height, 'Height', profileLimits.height),
      weight: numberError(draft.weight, 'Weight', profileLimits.weight),
      activityLevel: draft.activityLevel ? undefined : 'Activity level is required',
      targetWeight: numberError(draft.targetWeight, 'Target weight', profileLimits.targetWeight),
    }),
    [draft],
  );

  const isValid = Object.values(errors).every((error) => error === undefined);

  /**
   * Only complain about fields the user has actually filled in, so the form
   * doesn't shout on first render when the profile is still empty.
   */
  const shown = (field: keyof Draft) =>
    String(draft[field] ?? '').trim().length > 0 ? errors[field] : undefined;

  const save = async () => {
    if (!isValid || saving || !draft.gender || !draft.activityLevel) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Persist to the backend first — it is the source of truth. The local
      // onboarding store is updated only once the write succeeds, so the UI can
      // never show unsaved edits as if they were saved.
      await profileService.updateProfile({
        username: draft.username.trim(),
        age: Number(draft.age),
        gender: draft.gender,
        height: Number(draft.height),
        weight: Number(draft.weight),
        activityLevel: draft.activityLevel,
      });
      update({
        username: draft.username.trim(),
        age: draft.age.trim(),
        gender: draft.gender,
        height: draft.height.trim(),
        weight: draft.weight.trim(),
        activityLevel: draft.activityLevel,
        targetWeight: draft.targetWeight.trim(),
      });
      navigation.goBack();
    } catch (error) {
      setSaveError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not save your changes. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <DetailHeader title="Edit Profile" />

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
          <Text style={styles.caption}>
            Your plans and daily targets are recalculated from these details.
          </Text>

          <View style={styles.form}>
            <Field label="Username">
              <Input
                icon="user"
                value={draft.username}
                onChangeText={(value) => setDraftField('username', value)}
                placeholder="Enter your username"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
                maxLength={50}
              />
              <FieldError message={shown('username')} />
            </Field>

            <View style={styles.row}>
              <Field label="Age" style={styles.flex}>
                <Input
                  icon="calendar"
                  value={draft.age}
                  onChangeText={(value) => setDraftField('age', value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter age"
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <FieldError message={shown('age')} />
              </Field>

              <Field label="Gender" style={styles.flex}>
                <Select
                  title="Gender"
                  value={draft.gender}
                  options={genderOptions}
                  placeholder="Select gender"
                  onChange={(value) => setDraftField('gender', value)}
                />
              </Field>
            </View>

            <View style={styles.row}>
              <Field label="Height" style={styles.flex}>
                <Input
                  icon="bar-chart-2"
                  value={draft.height}
                  onChangeText={(value) => setDraftField('height', value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter height (cm)"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <FieldError message={shown('height')} />
              </Field>

              <Field label="Weight" style={styles.flex}>
                <Input
                  icon="trending-down"
                  value={draft.weight}
                  onChangeText={(value) => setDraftField('weight', value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter weight (kg)"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <FieldError message={shown('weight')} />
              </Field>
            </View>

            <Field label="Activity Level">
              <Select
                title="Activity Level"
                value={draft.activityLevel}
                options={activityOptions}
                placeholder="Select your activity level"
                onChange={(value) => setDraftField('activityLevel', value)}
              />
            </Field>

            <Field label="Target Weight">
              <Input
                icon="target"
                value={draft.targetWeight}
                onChangeText={(value) =>
                  setDraftField('targetWeight', value.replace(/[^0-9.]/g, ''))
                }
                placeholder="Enter target weight (kg)"
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <FieldError message={shown('targetWeight')} />
            </Field>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      <Button
        label={saving ? 'Saving…' : 'Save Changes'}
        disabled={!isValid || saving}
        accessibilityHint="Fill in every field to save"
        onPress={save}
      />
    </Screen>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  caption: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  form: {
    gap: spacing.base,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  saveError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

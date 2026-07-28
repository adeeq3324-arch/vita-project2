import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { ConditionCard } from '@/components/onboarding/ConditionCard';
import { Button } from '@/components/ui/Button';
import { conditionOptions } from '@/constants/profileOptions';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePlan } from '@/context/PlanContext';
import { ApiError, profileService } from '@/services';
import { colors, spacing, typography } from '@/theme';
import { nextConditions, sameConditions } from '@/utils/healthConditions';
import type { HealthCondition } from '@/types';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'EditHealthConditions'>;

/**
 * Updates the declared health conditions after onboarding. Like the goal
 * editor, saving clears generated plans so meals and supplements are rebuilt
 * against the new conditions.
 */
export function EditHealthConditionsScreen({ navigation }: Props) {
  const { data, update } = useOnboarding();
  const { reset: resetPlan } = usePlan();
  const [conditions, setConditions] = useState<HealthCondition[]>(data.conditions);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggle = (condition: HealthCondition) =>
    setConditions((prev) => nextConditions(prev, condition));

  const changed = !sameConditions(conditions, data.conditions);

  const save = async () => {
    if (conditions.length === 0 || saving) return;
    if (!changed) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Persist to the backend first; only mirror locally once it succeeds.
      await profileService.updateHealthConditions(conditions);
      update({ conditions });
      resetPlan('meal');
      resetPlan('supplement');
      navigation.goBack();
    } catch (error) {
      setSaveError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not save your conditions. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <DetailHeader title="Health Conditions" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.caption}>
          Select all that apply. Your plans avoid foods and supplements that conflict with these.
        </Text>

        <View style={styles.grid}>
          {conditionOptions.map((item) => (
            <View key={item.condition} style={styles.gridItem}>
              <ConditionCard
                label={item.label}
                icon={item.icon}
                accent={item.accent}
                selected={conditions.includes(item.condition)}
                onPress={() => toggle(item.condition)}
              />
            </View>
          ))}
        </View>

        {changed ? (
          <Text style={styles.notice}>
            Your meal and supplement plans will be regenerated for these conditions.
          </Text>
        ) : null}
      </ScrollView>

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      <Button
        label={saving ? 'Saving…' : 'Save Conditions'}
        disabled={conditions.length === 0 || saving}
        accessibilityHint="Select at least one option to save"
        onPress={save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.lg,
  },
  caption: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  gridItem: {
    // Two equal columns: a basis under 50% leaves room for the `gap` gutter,
    // and flexGrow reclaims the remainder so both columns stay equal width.
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
  },
  notice: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.base,
    textAlign: 'center',
  },
  saveError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});

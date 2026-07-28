import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { GoalCard } from '@/components/onboarding/GoalCard';
import { Button } from '@/components/ui/Button';
import { goalOptions } from '@/constants/profileOptions';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePlan } from '@/context/PlanContext';
import { ApiError, profileService } from '@/services';
import { colors, spacing, typography } from '@/theme';
import type { PrimaryGoal } from '@/types';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'ChangeGoal'>;

/**
 * Switches the primary goal after onboarding. Saving clears any generated meal
 * and supplement plans: they were built for the previous goal, so they are
 * regenerated the next time the user opens them.
 */
export function ChangeGoalScreen({ navigation }: Props) {
  const { data, update } = useOnboarding();
  const { reset: resetPlan } = usePlan();
  const [goal, setGoal] = useState<PrimaryGoal | null>(data.goal);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const changed = goal !== null && goal !== data.goal;

  const save = async () => {
    if (goal === null || saving) return;
    if (!changed) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Persist to the backend first; only mirror locally once it succeeds.
      await profileService.updateGoal({ primaryGoal: goal });
      update({ goal });
      resetPlan('meal');
      resetPlan('supplement');
      navigation.goBack();
    } catch (error) {
      setSaveError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Could not save your goal. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={{ top: true, bottom: true }}>
      <DetailHeader title="Change Goal" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.caption}>
          Your meal plan, supplements and daily targets follow the goal you pick here.
        </Text>

        <View style={styles.cards} accessibilityRole="radiogroup">
          {goalOptions.map((item) => (
            <GoalCard
              key={item.goal}
              goal={item.goal}
              title={item.title}
              description={item.description}
              selected={goal === item.goal}
              onPress={() => setGoal(item.goal)}
            />
          ))}
        </View>

        {changed ? (
          <Text style={styles.notice}>
            Your meal and supplement plans will be regenerated for this goal.
          </Text>
        ) : null}
      </ScrollView>

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      <Button
        label={saving ? 'Saving…' : 'Save Goal'}
        disabled={goal === null || saving}
        accessibilityHint="Select a goal to save"
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
  cards: {
    gap: spacing.md,
    marginTop: spacing.lg,
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

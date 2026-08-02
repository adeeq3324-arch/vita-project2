import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding } from '@/context/OnboardingContext';
import { usePlan, type PlanStatus } from '@/context/PlanContext';
import { useFocusRefresh } from '@/hooks';
import { aiRecommendation } from '@/services/ai';
import { colors, gradients, layout, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { AIRecommendationCard } from './planning/AIRecommendationCard';
import { PlanCard } from './planning/PlanCard';
import { WeekSummaryCard } from './planning/WeekSummaryCard';

type Props = BottomTabScreenProps<MainTabParamList, 'Planning'>;

/** CTA pill label reflecting whether a plan has been generated yet. */
function ctaLabel(status: PlanStatus, hasPlan: boolean): string {
  if (status === 'generating') return 'Generating…';
  if (hasPlan) return 'View Plan';
  if (status === 'failed') return 'Try again';
  return 'Generate';
}

export function PlanningScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const { meal, supplement, refresh } = usePlan();

  // The provider hydrates once, at app start, which is before a user who signs
  // in during this run has a session. Re-reading on focus is what closes that
  // gap — and it also picks up a plan generated on another device.
  useFocusRefresh(
    useCallback(async () => {
      await Promise.all([
        meal.status === 'generating' ? null : refresh('meal'),
        supplement.status === 'generating' ? null : refresh('supplement'),
      ]);
    }, [refresh, meal.status, supplement.status]),
  );

  const stack = navigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const openMealPlan = () => stack?.navigate('MealPlan');
  const openSupplements = () => stack?.navigate('SupplementPlan');

  // Counted from the plans themselves rather than from a target, so the summary
  // describes what was actually generated — a week that came back short reads as
  // short here too instead of quietly reporting the number it should have been.
  const mealsPlanned = meal.data?.days.reduce((sum, day) => sum + day.meals.length, 0) ?? 0;
  const supplementCount = supplement.data?.items.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Planning</Text>
        <Text style={styles.subtitle}>Generate a plan tailored to your goal</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.xl },
        ]}
      >
        <PlanCard
          title="Meal Plan"
          subtitle="Personalized 7-day meal plan"
          icon="silverware-fork-knife"
          image={require('../../../assets/images/planning/meal-plan.jpg')}
          gradient={gradients.weightLoss}
          ctaLabel={ctaLabel(meal.status, meal.data !== null)}
          onPress={openMealPlan}
        />
        <PlanCard
          title="Supplement Plan"
          subtitle="Personalized monthly supplement plan"
          icon="pill"
          image={require('../../../assets/images/planning/supplement-plan.jpg')}
          gradient={gradients.healthyLifestyle}
          ctaLabel={ctaLabel(supplement.status, supplement.data !== null)}
          onPress={openSupplements}
        />

        <Text style={styles.sectionTitle}>This Week Summary</Text>
        <WeekSummaryCard
          summary={{ mealsPlanned, supplements: supplementCount }}
        />
        <AIRecommendationCard text={aiRecommendation(data)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
});

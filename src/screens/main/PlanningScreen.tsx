import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { useOnboarding } from '@/context/OnboardingContext';
import { aiRecommendation, mealPlan, supplementSchedule, weekSummary } from '@/services/ai';
import { colors, gradients, layout, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { AIRecommendationCard } from './planning/AIRecommendationCard';
import { MealCard } from './planning/MealCard';
import { PlanCard } from './planning/PlanCard';
import { SupplementTimeline } from './planning/SupplementTimeline';
import { WeekSummaryCard } from './planning/WeekSummaryCard';

type Props = BottomTabScreenProps<MainTabParamList, 'Planning'>;
type Tab = 'overview' | 'meals' | 'supplements';

const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'meals', label: 'Meal Plan' },
  { value: 'supplements', label: 'Supplements' },
] as const;

export function PlanningScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const [tab, setTab] = useState<Tab>('overview');

  const stack = navigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const openMealPlan = () => stack?.navigate('MealPlan');
  const openSupplements = () => stack?.navigate('SupplementPlan');
  const openSupplement = (id: string) => stack?.navigate('SupplementDetail', { id });

  const supplements = supplementSchedule(data);
  const firstDay = mealPlan(data)[0]!;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Planning</Text>
        <Segmented options={tabs} value={tab} onChange={setTab} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.xl },
        ]}
      >
        {tab === 'overview' ? (
          <>
            <PlanCard
              title="Meal Plan"
              subtitle="Personalized 7-day meal plan"
              icon="silverware-fork-knife"
              gradient={gradients.weightLoss}
              onPress={openMealPlan}
            />
            <PlanCard
              title="Supplement Plan"
              subtitle="Personalized supplement schedule"
              icon="pill"
              gradient={gradients.healthyLifestyle}
              onPress={openSupplements}
            />
            <Text style={styles.sectionTitle}>This Week Summary</Text>
            <WeekSummaryCard summary={weekSummary(data)} />
            <AIRecommendationCard text={aiRecommendation(data)} />
          </>
        ) : null}

        {tab === 'meals' ? (
          <>
            <Text style={styles.sectionTitle}>Today · Day 1</Text>
            {firstDay.meals.map((meal) => (
              <MealCard key={meal.type} meal={meal} />
            ))}
            <PlanCard
              title="7-Day Meal Plan"
              subtitle="See every day and daily totals"
              icon="calendar-week"
              gradient={gradients.weightLoss}
              onPress={openMealPlan}
            />
          </>
        ) : null}

        {tab === 'supplements' ? (
          <>
            <Text style={styles.sectionTitle}>Daily Schedule</Text>
            <Card>
              <SupplementTimeline supplements={supplements} onSelect={openSupplement} />
            </Card>
          </>
        ) : null}
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
    gap: spacing.base,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
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

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding } from '@/context/OnboardingContext';
import { usePlan, type PlanStatus } from '@/context/PlanContext';
import { aiRecommendation, weekSummary } from '@/services/ai';
import { colors, gradients, layout, spacing, typography } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { AIRecommendationCard } from './planning/AIRecommendationCard';
import { PlanCard } from './planning/PlanCard';
import { WeekSummaryCard } from './planning/WeekSummaryCard';

type Props = BottomTabScreenProps<MainTabParamList, 'Planning'>;

/** CTA pill label reflecting whether a plan has been generated yet. */
function ctaLabel(status: PlanStatus): string {
  if (status === 'ready') return 'View Plan';
  if (status === 'generating') return 'Generating…';
  return 'Generate';
}

export function PlanningScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const { status } = usePlan();

  const stack = navigation.getParent<NativeStackNavigationProp<MainStackParamList>>();
  const openMealPlan = () => stack?.navigate('MealPlan');
  const openSupplements = () => stack?.navigate('SupplementPlan');

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
          ctaLabel={ctaLabel(status.meal)}
          onPress={openMealPlan}
        />
        <PlanCard
          title="Supplement Plan"
          subtitle="Personalized monthly supplement plan"
          icon="pill"
          image={require('../../../assets/images/planning/supplement-plan.jpg')}
          gradient={gradients.healthyLifestyle}
          ctaLabel={ctaLabel(status.supplement)}
          onPress={openSupplements}
        />

        <Text style={styles.sectionTitle}>This Week Summary</Text>
        <WeekSummaryCard summary={weekSummary(data)} />
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

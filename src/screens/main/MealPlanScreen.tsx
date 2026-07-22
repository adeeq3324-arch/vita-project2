import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePlan } from '@/context/PlanContext';
import { dailyTotals, mealPlan } from '@/services/ai';
import { colors, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

import { GenerateGate } from './planning/GenerateGate';
import { MealCard } from './planning/MealCard';

type Props = NativeStackScreenProps<MainStackParamList, 'MealPlan'>;

export function MealPlanScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const { status, generate } = usePlan();
  const [dayIndex, setDayIndex] = useState(0);

  if (status.meal !== 'ready') {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <DetailHeader title="Meal Plan" />
        <GenerateGate
          icon="silverware-fork-knife"
          accent="green"
          title="Your AI Meal Plan"
          description="Generate a 7-day meal plan built around your goal, calorie target and food preferences."
          points={['7 days of meals', 'Calories & macros balanced', 'Full recipe for every meal']}
          loading={status.meal === 'generating'}
          onGenerate={() => generate('meal')}
        />
      </Screen>
    );
  }

  const plan = mealPlan(data);
  const day = plan[dayIndex]!;
  const totals = dailyTotals(day);

  const macros = [
    { label: 'Protein', value: `${totals.protein}g`, color: colors.metric.protein },
    { label: 'Carbs', value: `${totals.carbs}g`, color: colors.metric.carbs },
    { label: 'Fat', value: `${totals.fat}g`, color: colors.metric.fat },
  ];

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="7-Day Meal Plan" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
        style={styles.daysRow}
      >
        {plan.map((entry, index) => {
          const selected = index === dayIndex;
          return (
            <Pressable
              key={entry.day}
              onPress={() => setDayIndex(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.dayPill, selected && styles.dayPillActive]}
            >
              <Text style={[styles.dayText, selected && styles.dayTextActive]}>Day {entry.day}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {day.meals.map((meal) => (
          <MealCard
            key={meal.type}
            meal={meal}
            onPress={() => navigation.navigate('MealDetail', { day: day.day, type: meal.type })}
          />
        ))}

        <Card style={styles.totals}>
          <View style={styles.totalMain}>
            <Text style={styles.totalLabel}>Daily Total</Text>
            <Text style={styles.totalKcal}>
              {totals.kcal.toLocaleString()} <Text style={styles.totalKcalUnit}>kcal</Text>
            </Text>
          </View>
          <View style={styles.macroRow}>
            {macros.map((macro) => (
              <View key={macro.label} style={styles.macro}>
                <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
                <Text style={styles.macroValue}>{macro.value}</Text>
                <Text style={styles.macroLabel}>{macro.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  daysRow: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  days: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dayPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
  },
  dayPillActive: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...typography.label,
    color: colors.text.secondary,
  },
  dayTextActive: {
    color: colors.white,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  totals: {
    marginTop: spacing.xs,
  },
  totalMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  totalLabel: {
    ...typography.h4,
    color: colors.text.primary,
  },
  totalKcal: {
    ...typography.h2,
    color: colors.primary,
  },
  totalKcalUnit: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macro: {
    flex: 1,
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  macroValue: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  macroLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});

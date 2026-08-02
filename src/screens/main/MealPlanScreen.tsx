import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/StateView';
import { usePlan } from '@/context/PlanContext';
import { colors, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';
import type { MealPlanDay } from '@/services/planning/planningService';

import { GenerateGate } from './planning/GenerateGate';
import { formatGrams, PlannedMealCard } from './planning/PlannedMealCard';
import { PlanBanner } from './planning/PlanBanner';
import { PlanHeader } from './planning/PlanHeader';
import { WeekStrip } from './planning/WeekStrip';

type Props = NativeStackScreenProps<MainStackParamList, 'MealPlan'>;

const MEAL_TINT = {
  color: colors.plan.meal,
  surface: colors.plan.mealSurface,
  dark: colors.plan.mealDark,
};

export function MealPlanScreen({ navigation }: Props) {
  const { meal, hydrating, generate, refresh } = usePlan();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = useMemo(() => localToday(), []);
  const plan = meal.data;

  // The plan opens on today when it covers today, and on its first day
  // otherwise. Held as null until the user picks, so a plan that arrives after
  // the screen mounts still lands on the right day rather than on day one.
  const days = plan?.days ?? [];
  const dayOfWeek = selectedDay ?? defaultDay(days, today);
  const day = days.find((entry) => entry.dayOfWeek === dayOfWeek) ?? days[0];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh('meal');
    } finally {
      setRefreshing(false);
    }
  };

  if (hydrating) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <PlanHeader title="Meals Plan" subtitle="This week" />
        <LoadingState label="Loading your plan…" />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <PlanHeader title="Meals Plan" subtitle="This week" />
        <GenerateGate
          icon="silverware-fork-knife"
          tint={MEAL_TINT}
          title="Your AI Meal Plan"
          description="A seven-day plan built around your calorie target, your macro split and the conditions on your health profile."
          points={[
            'Seven days, every meal',
            'Calories, protein, carbs, fat and fibre',
            'A reason behind every dish',
          ]}
          loading={meal.status === 'generating'}
          error={meal.error}
          onGenerate={() => void generate('meal')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <PlanHeader
        title="Meals Plan"
        subtitle="This week"
        regenerating={meal.status === 'generating'}
        onRegenerate={() => void generate('meal')}
      />

      <WeekStrip
        days={plan.days}
        selectedDayOfWeek={dayOfWeek}
        onSelect={setSelectedDay}
        today={today}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.plan.meal}
          />
        }
      >
        <PlanBanner
          title="Your AI meal plan is ready"
          subtitle="Balanced meals tailored to your goals."
          tint={colors.plan.meal}
        />

        {day ? (
          <>
            <Text style={styles.dayHeading}>{dayHeading(day)}</Text>

            {day.meals.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No meals for this day"
                message="The plan came back short for this day. Regenerating usually fixes it."
                action="Regenerate"
                onAction={() => void generate('meal')}
              />
            ) : (
              day.meals.map((entry) => (
                <PlannedMealCard
                  key={entry.id}
                  meal={entry}
                  onPress={() =>
                    navigation.navigate('MealDetail', {
                      mealPlanId: plan.mealPlanId,
                      mealId: entry.id,
                    })
                  }
                />
              ))
            )}

            <Card style={styles.totals}>
              <View style={styles.totalsHeader}>
                <Text style={styles.totalsLabel}>Daily Total</Text>
                <Text style={styles.totalsKcal}>
                  {day.totals.kcal.toLocaleString()}{' '}
                  <Text style={styles.totalsUnit}>/ {plan.calorieTarget.toLocaleString()} kcal</Text>
                </Text>
              </View>
              <View style={styles.totalsRow}>
                <Total label="Protein" value={day.totals.protein} color={colors.metric.protein} />
                <Total label="Carbs" value={day.totals.carbs} color={colors.metric.carbs} />
                <Total label="Fat" value={day.totals.fat} color={colors.metric.fat} />
                <Total label="Fiber" value={day.totals.fiber} color={colors.metric.fiber} />
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.total}>
      <View style={[styles.totalDot, { backgroundColor: color }]} />
      <Text style={styles.totalValue}>{formatGrams(value)}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

/** Today's calendar date in the device's own zone, as `YYYY-MM-DD`. */
function localToday(): string {
  // `en-CA` is used because its short date format *is* ISO-8601, which keeps
  // this comparable to the dates the API returns without any parsing.
  return new Date().toLocaleDateString('en-CA');
}

/** The day a plan should open on: today when it covers today, else its first. */
function defaultDay(days: readonly MealPlanDay[], today: string): number {
  return days.find((day) => day.date === today)?.dayOfWeek ?? days[0]?.dayOfWeek ?? 1;
}

/** "Monday, 21 Jul" — the heading over a day's meals. */
function dayHeading(day: MealPlanDay): string {
  const date = new Date(`${day.date}T12:00:00Z`);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(date);
  return `${day.dayName}, ${formatted}`;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  dayHeading: {
    ...typography.h4,
    color: colors.plan.ink,
    marginTop: spacing.xs,
  },
  totals: {
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  totalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalsLabel: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  totalsKcal: {
    ...typography.h4,
    color: colors.plan.mealDark,
  },
  totalsUnit: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  total: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  totalDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: 2,
  },
  totalValue: {
    ...typography.bodyStrong,
    color: colors.plan.ink,
  },
  totalLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
  },
});

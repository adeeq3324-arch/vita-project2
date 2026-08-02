import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { usePlan } from '@/context/PlanContext';
import { planningService } from '@/services';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';
import type { PlannedMeal } from '@/services/planning/planningService';

import {
  InsightCard,
  StatCell,
  StatRow,
} from './planning/DetailSections';
import { MEAL_ICON, MEAL_LABEL } from './planning/mealMeta';
import { formatClockTime } from './planning/mealTime';
import { NutritionBreakdown } from './planning/NutritionBreakdown';
import { NutritionFacts } from './planning/NutritionFacts';
import { PlanImage } from './planning/PlanImage';
import { formatGrams } from './planning/PlannedMealCard';
import { ViewRecipeButton } from './planning/ViewRecipeButton';

type Props = NativeStackScreenProps<MainStackParamList, 'MealDetail'>;

const HERO_HEIGHT = 260;

const MEAL_TINT = {
  surface: colors.plan.mealSurface,
  dark: colors.plan.mealDark,
};

export function MealDetailScreen({ route, navigation }: Props) {
  const { mealPlanId, mealId } = route.params;
  const { meal: mealPlan, refresh } = usePlan();
  const insets = useSafeAreaInsets();

  // The plan already in memory is the fastest correct answer; the fetch below
  // only runs when this screen was reached without it (a deep link, or a plan
  // read after this screen mounted).
  const cached = mealPlan.data?.days
    .flatMap((day) => day.meals)
    .find((entry) => entry.id === mealId);

  const [meal, setMeal] = useState<PlannedMeal | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  /** Bumped to ask for the meal again after a failed read. */
  const [attempt, setAttempt] = useState(0);

  // Only runs when the plan was not already in memory — a deep link, or a plan
  // that arrived after this screen mounted.
  useEffect(() => {
    if (meal) return undefined;
    let active = true;

    void (async () => {
      try {
        const fetched = await planningService.getPlannedMeal(mealPlanId, mealId);
        if (active) setMeal(fetched);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'This meal could not be loaded.');
      }
    })();

    return () => {
      active = false;
    };
  }, [mealPlanId, mealId, meal, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((count) => count + 1);
  }, []);

  const onSwap = async () => {
    setSwapping(true);
    setError(null);
    try {
      const replacement = await planningService.swapPlannedMeal(mealPlanId, mealId);
      setMeal(replacement);
      // The week's list and its daily totals now disagree with what is on this
      // screen, so the plan behind it is re-read rather than patched in place.
      await refresh('meal');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'This meal could not be swapped. Try again.',
      );
    } finally {
      setSwapping(false);
    }
  };

  const time = formatClockTime(meal?.scheduledTime);

  if (!meal) {
    return (
      <View style={styles.screen}>
        <View style={[styles.fallbackHeader, { paddingTop: insets.top + spacing.sm }]}>
          <BackControl onPress={() => navigation.goBack()} floating={false} />
        </View>
        {error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <LoadingState label="Loading this meal…" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl }]}
      >
        <View style={styles.hero}>
          <PlanImage
            uri={meal.imageUrl}
            icon={MEAL_ICON[meal.mealType]}
            tint={{ surface: colors.plan.mealSurface, color: colors.plan.meal }}
            iconSize={64}
            style={styles.heroImage}
            accessibilityLabel={meal.name}
          />
          <View style={[styles.heroControls, { top: insets.top + spacing.sm }]}>
            <BackControl onPress={() => navigation.goBack()} floating />
          </View>
          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <MaterialCommunityIcons
                name={MEAL_ICON[meal.mealType]}
                size={12}
                color={colors.plan.mealDark}
              />
              <Text style={styles.heroChipText}>{MEAL_LABEL[meal.mealType]}</Text>
            </View>

            {/*
              When to eat it, carried right next to what sitting it is. The two
              answer one question together — where this dish sits in the day —
              and separating them would leave the schedule buried in a list the
              user has to go back to.
            */}
            {time ? (
              <View style={styles.heroChip}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={12}
                  color={colors.plan.mealDark}
                />
                <Text style={styles.heroChipText}>{time}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{meal.name}</Text>

          <StatRow>
            <StatCell
              icon="fire"
              value={meal.kcal.toLocaleString()}
              label="Calories"
              color={colors.metric.calories}
            />
            <StatCell
              icon="food-drumstick"
              value={formatGrams(meal.protein)}
              label="Protein"
              color={colors.metric.protein}
            />
            <StatCell
              icon="barley"
              value={formatGrams(meal.carbs)}
              label="Carbs"
              color={colors.metric.carbs}
            />
            <StatCell
              icon="oil"
              value={formatGrams(meal.fat)}
              label="Fat"
              color={colors.metric.fat}
            />
            <StatCell
              icon="leaf"
              value={formatGrams(meal.fiber)}
              label="Fiber"
              color={colors.metric.fiber}
            />
          </StatRow>

          {meal.reasoning ? (
            <InsightCard
              title="Why this fits your goal"
              body={meal.reasoning}
              tint={MEAL_TINT}
            />
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition Breakdown</Text>
            <NutritionBreakdown nutrients={meal} />
          </View>

          {/*
            Only present when the dish was matched to a recipe somebody actually
            weighed. See `NutritionFacts` on why an unmatched dish shows nothing
            here rather than a table of dashes.
          */}
          <NutritionFacts facts={meal.facts} source={meal.source} />

          {/*
            The dish carries its name and photograph across so the recipe screen
            can paint its hero before the method has been written — the first
            request for a dish generates it, and the wait belongs under the
            picture of what they are about to cook, not instead of it.
          */}
          <ViewRecipeButton
            onPress={() =>
              navigation.navigate('MealRecipe', {
                mealPlanId,
                mealId: meal.id,
                mealName: meal.name,
                imageUrl: meal.imageUrl,
                mealType: meal.mealType,
              })
            }
          />

          {error ? (
            <View style={styles.error}>
              <Feather name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.base) },
        ]}
      >
        <Button
          label={swapping ? 'Finding another…' : 'Swap Meal'}
          loading={swapping}
          onPress={() => void onSwap()}
          accessibilityHint="Replaces this meal with a different dish of similar nutrition"
        />
      </View>
    </View>
  );
}

/**
 * Back affordance for a screen whose header sits over a photograph.
 *
 * `floating` gives it its own opaque disc: a bare chevron is unreadable against
 * an arbitrary image, and the same control has to work over the tinted fallback
 * tile as well.
 */
function BackControl({ onPress, floating }: { onPress: () => void; floating: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.back,
        floating && styles.backFloating,
        pressed && styles.backPressed,
      ]}
    >
      <Feather name="chevron-left" size={24} color={colors.plan.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  fallbackHeader: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },
  hero: {
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
  },
  heroControls: {
    position: 'absolute',
    left: layout.screenPadding,
  },
  heroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    margin: layout.screenPadding,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  heroChipText: {
    ...typography.micro,
    color: colors.plan.mealDark,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFloating: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  backPressed: {
    opacity: 0.7,
  },
  body: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    gap: spacing.base,
  },
  name: {
    ...typography.h2,
    color: colors.plan.ink,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSurface,
  },
  errorText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});

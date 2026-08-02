import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/StateView';
import { planningService } from '@/services';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';
import type { MealRecipe } from '@/services/planning/planningService';

import { StatCell, StatRow } from './planning/DetailSections';
import { MEAL_ICON, MEAL_LABEL } from './planning/mealMeta';
import { SourceCredit } from './planning/NutritionFacts';
import { PlanImage } from './planning/PlanImage';
import { formatGrams } from './planning/PlannedMealCard';
import { RecipeIngredients } from './planning/RecipeIngredients';
import { RecipeSteps } from './planning/RecipeSteps';
import { RecipeTimeCard } from './planning/RecipeTimeCard';
import { RecipeTips } from './planning/RecipeTips';

type Props = NativeStackScreenProps<MainStackParamList, 'MealRecipe'>;

/** Native transform driver isn't supported on web; fall back to the JS driver. */
const USE_NATIVE = Platform.OS !== 'web';

const HERO_HEIGHT = 320;
/** How far the content sheet rides up over the photograph. */
const SHEET_OVERLAP = 28;
const APP_BAR_HEIGHT = 52;

const MEAL_TINT = { surface: colors.plan.mealSurface, color: colors.plan.meal };

/**
 * How to cook one planned meal.
 *
 * The screen is built around a single idea: everything above the fold should
 * make the dish worth cooking, and everything below it should be usable while
 * cooking. So the photograph is given real height and parallaxes under a sheet
 * that carries the practical half — timings, shopping list, method, tips — and
 * the two halves never compete for the same attention.
 *
 * The recipe is generated the first time anyone opens a dish, which is why the
 * hero paints from the params it was pushed with rather than waiting for the
 * response. A user who taps "View Recipe" sees their meal immediately and the
 * method a moment later, instead of a blank screen for both.
 */
export function MealRecipeScreen({ route, navigation }: Props) {
  const { mealPlanId, mealId, mealName, imageUrl, mealType } = route.params;
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<MealRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped to ask for the recipe again after a failed attempt. */
  const [attempt, setAttempt] = useState(0);

  // Read during render by every animated style, so it is state rather than a ref.
  const [scrollY] = useState(() => new Animated.Value(0));

  // The error is cleared by `retry` before it bumps `attempt`, so the effect
  // never has to reset state on its way in.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const fetched = await planningService.getMealRecipe(mealPlanId, mealId);
        if (!active) return;
        setRecipe(fetched);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'This recipe could not be prepared. Please try again.',
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [mealPlanId, mealId, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((count) => count + 1);
  }, []);

  // The response is authoritative, but the params are what make the first frame
  // whole — a deep link simply has neither, and falls back to the generic tile.
  const title = recipe?.name ?? mealName ?? 'Recipe';
  const photo = recipe?.imageUrl ?? imageUrl ?? null;
  const sitting = recipe?.mealType ?? mealType ?? null;

  // Pulling down enlarges the photograph rather than exposing the background;
  // scrolling up drifts it at a third of the sheet's speed, so the two layers
  // read as depth instead of as one long page.
  const heroTranslate = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, HERO_HEIGHT / 3],
    extrapolateLeft: 'clamp',
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [2.4, 1],
    extrapolateRight: 'clamp',
  });
  const heroCopyOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // The bar takes over the title exactly as the hero's own copy finishes
  // leaving, so the dish is named continuously and never twice at once.
  const barOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT * 0.45, HERO_HEIGHT * 0.7],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: USE_NATIVE,
        })}
      >
        <View style={styles.hero}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: heroTranslate }, { scale: heroScale }] },
            ]}
          >
            <PlanImage
              uri={photo}
              icon={sitting ? MEAL_ICON[sitting] : 'silverware-fork-knife'}
              tint={MEAL_TINT}
              iconSize={80}
              style={styles.heroImage}
              accessibilityLabel={title}
            />
          </Animated.View>

          {/* Earns the white copy its contrast over an arbitrary photograph. */}
          <LinearGradient
            colors={['rgba(26,13,10,0)', 'rgba(26,13,10,0.35)', 'rgba(26,13,10,0.82)']}
            locations={[0, 0.45, 1]}
            style={styles.heroScrim}
            pointerEvents="none"
          />

          <Animated.View style={[styles.heroCopy, { opacity: heroCopyOpacity }]}>
            {sitting ? (
              <View style={styles.heroChip}>
                <MaterialCommunityIcons
                  name={MEAL_ICON[sitting]}
                  size={12}
                  color={colors.white}
                />
                <Text style={styles.heroChipText}>{MEAL_LABEL[sitting]}</Text>
              </View>
            ) : null}
            <Text style={styles.heroTitle} numberOfLines={3}>
              {title}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.sheet}>
          {recipe ? (
            <RecipeBody recipe={recipe} />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : (
            <PreparingState />
          )}
        </View>
      </Animated.ScrollView>

      <Animated.View
        style={[styles.appBar, { paddingTop: insets.top, opacity: barOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.appBarTitle} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>

      <View style={[styles.controls, { top: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Feather name="chevron-left" size={24} color={colors.plan.ink} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The practical half, in the order a cook meets it: how long it takes, what it
 * is, what it costs against the day, what to buy, what to do, what to watch for.
 */
function RecipeBody({ recipe }: { recipe: MealRecipe }) {
  return (
    <View style={styles.body}>
      <RecipeTimeCard
        prepMinutes={recipe.prepMinutes}
        cookMinutes={recipe.cookMinutes}
        totalMinutes={recipe.totalMinutes}
        servings={recipe.servings}
        difficulty={recipe.difficulty}
        cuisine={recipe.cuisine}
      />

      {recipe.summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This Dish</Text>
          <Text style={styles.prose}>{recipe.summary}</Text>
          {/*
            Sits under the description rather than at the foot of the page: a
            cook deciding whether to follow this method should know up front
            whether a person published it or the plan assembled it, and a credit
            below the last tip is a credit nobody reads.
          */}
          <SourceCredit source={recipe.source} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nutrition Per Serving</Text>
        <StatRow>
          <StatCell
            icon="fire"
            value={recipe.kcal.toLocaleString()}
            label="Calories"
            color={colors.metric.calories}
          />
          <StatCell
            icon="food-drumstick"
            value={formatGrams(recipe.protein)}
            label="Protein"
            color={colors.metric.protein}
          />
          <StatCell
            icon="barley"
            value={formatGrams(recipe.carbs)}
            label="Carbs"
            color={colors.metric.carbs}
          />
          <StatCell
            icon="oil"
            value={formatGrams(recipe.fat)}
            label="Fat"
            color={colors.metric.fat}
          />
          <StatCell
            icon="leaf"
            value={formatGrams(recipe.fiber)}
            label="Fiber"
            color={colors.metric.fiber}
          />
        </StatRow>
      </View>

      <RecipeIngredients ingredients={recipe.ingredients} servings={recipe.servings} />
      <RecipeSteps steps={recipe.steps} />
      <RecipeTips tips={recipe.tips} />
    </View>
  );
}

/**
 * The wait while a recipe is written for the first time.
 *
 * Says what is happening and that it only happens once, because this is a
 * several-second wait rather than a network round trip, and a bare spinner for
 * that long reads as a screen that has stopped working.
 */
function PreparingState() {
  return (
    <View style={styles.preparing}>
      <View style={styles.preparingIcon}>
        <MaterialCommunityIcons name="chef-hat" size={26} color={colors.plan.mealDark} />
      </View>
      <Text style={styles.preparingTitle}>Writing your recipe…</Text>
      <Text style={styles.preparingBody}>
        We’re putting together the ingredients, the method and the timings for this dish.
        It only takes a moment, and it’s saved for next time.
      </Text>
      <ActivityIndicator color={colors.plan.meal} style={styles.preparingSpinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
    backgroundColor: colors.plan.mealSurface,
    // The photograph scales past its own box on overscroll; without this it
    // would spill over the sheet below it.
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroCopy: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: SHEET_OVERLAP + spacing.base,
    gap: spacing.sm,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroChipText: {
    ...typography.micro,
    color: colors.white,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.white,
  },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    backgroundColor: colors.background,
    minHeight: 360,
  },
  body: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  prose: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  appBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  appBarTitle: {
    ...typography.h4,
    color: colors.plan.ink,
    height: APP_BAR_HEIGHT,
    lineHeight: APP_BAR_HEIGHT,
    textAlign: 'center',
    // Clears the back control on the left, and the same amount on the right so
    // the title stays optically centred rather than merely centred in what is
    // left over.
    paddingHorizontal: 56,
  },
  controls: {
    position: 'absolute',
    left: layout.screenPadding,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  backPressed: {
    opacity: 0.7,
  },
  preparing: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  preparingIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.plan.mealSurface,
    marginBottom: spacing.xs,
  },
  preparingTitle: {
    ...typography.h4,
    color: colors.plan.ink,
  },
  preparingBody: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 19,
  },
  preparingSpinner: {
    marginTop: spacing.md,
  },
});

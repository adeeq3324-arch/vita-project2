import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DonutChart } from '@/components/charts/DonutChart';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateView';
import { useFoodDiary } from '@/context/FoodDiaryContext';
import { useFocusRefresh, useResource } from '@/hooks';
import { AddCustomMealModal } from '@/screens/main/foodtracking/AddCustomMealModal';
import {
  getTargets,
  searchFoods,
  type Food,
  type MealDraft,
} from '@/services/nutrition/nutritionService';
import { colors, radius, spacing, typography } from '@/theme';
import { accentName, materialIcon } from '@/utils/icons';

/** Debounce for the search box, so a typed word is one request, not five. */
const SEARCH_DEBOUNCE_MS = 300;

export function FoodTrackingScreen() {
  const diary = useFoodDiary();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useResource(() => searchFoods(debouncedQuery), [debouncedQuery]);
  const targets = useResource(() => getTargets(), []);

  const refreshDiary = useCallback(() => diary.refresh(), [diary]);
  useFocusRefresh(refreshDiary);

  const { totals } = diary;
  const calorieTarget = targets.data?.calories ?? null;

  const log = async (draft: MealDraft, key: string) => {
    setAddingId(key);
    try {
      await diary.addMeal(draft);
    } catch (error) {
      Alert.alert(
        'Could not log that meal',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setAddingId(null);
    }
  };

  const remove = (id: string, name: string) => {
    Alert.alert('Remove entry', `Remove “${name}” from today’s diary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void diary.removeMeal(id).catch((error: unknown) =>
            Alert.alert(
              'Could not remove that entry',
              error instanceof Error ? error.message : 'Please try again.',
            ),
          );
        },
      },
    ]);
  };

  const macroSegments = [
    { value: totals.protein, color: colors.metric.protein },
    { value: totals.carbs, color: colors.metric.carbs },
    { value: totals.fat, color: colors.metric.fat },
  ].filter((segment) => segment.value > 0);

  const macroLegend = [
    { label: 'Protein', value: `${totals.protein}g`, color: colors.metric.protein },
    { label: 'Carbs', value: `${totals.carbs}g`, color: colors.metric.carbs },
    { label: 'Fat', value: `${totals.fat}g`, color: colors.metric.fat },
  ];

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Add Meal" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.text.disabled} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search food"
            placeholderTextColor={colors.text.disabled}
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
              <Feather name="x" size={18} color={colors.text.disabled} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{debouncedQuery ? 'Results' : 'Food Catalogue'}</Text>
        <Card padding="none" style={styles.list}>
          {results.loading ? <LoadingState label="Searching…" /> : null}

          {results.error && !results.data ? (
            <ErrorState message={results.error.message} onRetry={results.refresh} />
          ) : null}

          {results.data?.items.length === 0 ? (
            <EmptyState
              icon="search"
              title="No matches"
              message={
                debouncedQuery
                  ? `Nothing in the catalogue matches “${debouncedQuery}”. Add it as a custom meal instead.`
                  : 'The food catalogue is empty.'
              }
            />
          ) : null}

          {results.data?.items.map((food, index) => (
            <View key={food.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <FoodRow
                food={food}
                busy={addingId === food.id}
                onAdd={() => log({ foodId: food.id, servings: 1 }, food.id)}
              />
            </View>
          ))}
        </Card>

        <Pressable
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.customBtn, pressed && styles.customBtnPressed]}
        >
          <Feather name="plus" size={18} color={colors.white} />
          <Text style={styles.customBtnText}>Add Custom Meal</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Today</Text>
        <Card>
          <View style={styles.historyRow}>
            <DonutChart
              segments={macroSegments}
              size={104}
              strokeWidth={14}
              centerLabel={totals.kcal.toLocaleString()}
              centerSub="kcal"
            />
            <View style={styles.historySide}>
              <Text style={styles.historyTitle}>{diary.mealCount === 1 ? '1 meal' : `${diary.mealCount} meals`}</Text>
              <Text style={styles.historyTotal}>
                {totals.kcal.toLocaleString()}
                <Text style={styles.historyTarget}>
                  {calorieTarget ? ` / ${calorieTarget.toLocaleString()} kcal` : ' kcal'}
                </Text>
              </Text>
              <View style={styles.legend}>
                {macroLegend.map((macro) => (
                  <View key={macro.label} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: macro.color }]} />
                    <Text style={styles.legendLabel}>{macro.label}</Text>
                    <Text style={styles.legendValue}>{macro.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {diary.loading && diary.mealCount === 0 ? (
            <LoadingState label="Loading your diary…" />
          ) : diary.error && diary.mealCount === 0 ? (
            <ErrorState message={diary.error.message} onRetry={refreshDiary} />
          ) : diary.meals.length === 0 ? (
            <EmptyState
              icon="coffee"
              title="Nothing logged today"
              message="Add a meal from the catalogue above and your totals update straight away."
            />
          ) : (
            diary.meals.map((meal, index) => (
              <View key={meal.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.mealRow}>
                  <View
                    style={[
                      styles.thumb,
                      { backgroundColor: colors.accentSurface[accentName(meal.accent)] },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={materialIcon(meal.icon)}
                      size={20}
                      color={colors.accent[accentName(meal.accent)]}
                    />
                  </View>
                  <View style={styles.mealCopy}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealMeta}>
                      {meal.kcal} kcal · {meal.time}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => remove(meal.id, meal.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${meal.name}`}
                    hitSlop={8}
                    style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
                  >
                    <Feather name="trash-2" size={16} color={colors.text.tertiary} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <AddCustomMealModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(draft) => {
          setModalOpen(false);
          void log(draft, 'custom');
        }}
      />
    </Screen>
  );
}

function FoodRow({ food, busy, onAdd }: { food: Food; busy: boolean; onAdd: () => void }) {
  const accent = accentName(food.accent);

  return (
    <View style={styles.mealRow}>
      <View style={[styles.thumb, { backgroundColor: colors.accentSurface[accent] }]}>
        <MaterialCommunityIcons
          name={materialIcon(food.icon)}
          size={20}
          color={colors.accent[accent]}
        />
      </View>
      <View style={styles.mealCopy}>
        <Text style={styles.mealName} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={styles.mealMeta} numberOfLines={1}>
          {food.kcal} kcal · {food.serving.label}
          {food.brand ? ` · ${food.brand}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onAdd}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Add ${food.name}`}
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Feather name="plus" size={18} color={colors.white} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    height: 48,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  list: {
    paddingHorizontal: spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCopy: { flex: 1 },
  mealName: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  mealMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPressed: {
    backgroundColor: colors.primaryDark,
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnPressed: {
    backgroundColor: colors.divider,
  },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.base,
    backgroundColor: colors.primary,
  },
  customBtnPressed: {
    backgroundColor: colors.primaryDark,
  },
  customBtnText: {
    ...typography.button,
    color: colors.white,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  historySide: {
    flex: 1,
  },
  historyTitle: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  historyTotal: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  historyTarget: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  legend: {
    gap: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  legendValue: {
    ...typography.label,
    color: colors.text.primary,
  },
});

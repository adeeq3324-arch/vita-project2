import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DonutChart } from '@/components/charts/DonutChart';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { AddCustomMealModal } from '@/screens/main/foodtracking/AddCustomMealModal';
import { useFoodDiary, type MealDraft } from '@/context/FoodDiaryContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { calorieTarget } from '@/services/ai/profile';
import { colors, radius, spacing, typography } from '@/theme';
import type { AIIcon } from '@/services/ai/types';

/** Quick-add suggestions surfaced under "Recent Meals". */
const suggestions: (MealDraft & { subtitle: string })[] = [
  { name: 'Grilled Chicken Salad', kcal: 520, protein: 42, carbs: 30, fat: 24, icon: 'bowl-mix', accent: 'green', subtitle: 'Today · 12:30 PM' },
  { name: 'Oatmeal with Berries', kcal: 340, protein: 12, carbs: 54, fat: 6, icon: 'coffee', accent: 'orange', subtitle: 'Today · 8:30 AM' },
  { name: 'Protein Smoothie', kcal: 320, protein: 28, carbs: 40, fat: 7, icon: 'cup', accent: 'violet', subtitle: 'Yesterday · 6:00 PM' },
];

export function FoodTrackingScreen() {
  const { data } = useOnboarding();
  const { meals, totals, addMeal } = useFoodDiary();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const target = calorieTarget(data);
  const filtered = useMemo(
    () => suggestions.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  const macroSegments = [
    { value: Math.max(totals.protein, 0.1), color: colors.metric.protein },
    { value: Math.max(totals.carbs, 0.1), color: colors.metric.carbs },
    { value: Math.max(totals.fat, 0.1), color: colors.metric.fat },
  ];
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
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.sectionTitle}>Recent Meals</Text>
        <Card padding="none" style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No matches for “{query}”.</Text>
          ) : (
            filtered.map((meal, index) => (
              <View key={meal.name}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.mealRow}>
                  <View style={[styles.thumb, { backgroundColor: colors.accentSurface[meal.accent] }]}>
                    <MaterialCommunityIcons name={meal.icon as AIIcon} size={20} color={colors.accent[meal.accent]} />
                  </View>
                  <View style={styles.mealCopy}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealMeta}>
                      {meal.kcal} kcal · {meal.subtitle}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => addMeal(meal)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${meal.name}`}
                    style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
                  >
                    <Feather name="plus" size={18} color={colors.white} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </Card>

        <Pressable
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.customBtn, pressed && styles.customBtnPressed]}
        >
          <Feather name="plus" size={18} color={colors.white} />
          <Text style={styles.customBtnText}>Add Custom Meal</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Meal History</Text>
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
              <Text style={styles.historyTitle}>Today</Text>
              <Text style={styles.historyTotal}>
                {totals.kcal.toLocaleString()}
                <Text style={styles.historyTarget}> / {target.toLocaleString()} kcal</Text>
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
          <Text style={styles.loggedTitle}>{meals.length} meals logged today</Text>
        </Card>
      </ScrollView>

      <AddCustomMealModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(draft) => {
          addMeal(draft);
          setModalOpen(false);
        }}
      />
    </Screen>
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
  empty: {
    ...typography.body,
    color: colors.text.tertiary,
    paddingVertical: spacing.lg,
    textAlign: 'center',
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
  loggedTitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});

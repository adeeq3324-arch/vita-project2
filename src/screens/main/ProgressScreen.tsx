import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/ui/Segmented';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { useDataChanged, useFocusRefresh, useResource } from '@/hooks';
import { getOverview, type ProgressPeriod } from '@/services/progress/progressService';
import { colors, layout, spacing, typography } from '@/theme';

import { LogWeightSheet } from './metrics/LogWeightSheet';
import { LogWorkoutSheet } from './metrics/LogWorkoutSheet';
import { AchievementsCard } from './progress/AchievementsCard';
import { BodyProgressCard } from './progress/BodyProgressCard';
import { FitnessProgressCard } from './progress/FitnessProgressCard';
import { HealthSummaryCard } from './progress/HealthSummaryCard';
import { MilestonesCard } from './progress/MilestonesCard';
import { NutritionProgressCard } from './progress/NutritionProgressCard';
import { TipsList } from './progress/TipsList';
import { tipsFor } from './progress/progressTips';
import { WaterIntakeCard } from './progress/WaterIntakeCard';

type Tab = ProgressPeriod | 'tips';

const tabs = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'tips', label: 'Tips' },
] as const;

export function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('week');

  // Tips are derived from the same payload, so they read the period the user
  // last looked at rather than triggering a fetch of their own.
  const [period, setPeriod] = useState<ProgressPeriod>('week');
  const [weightOpen, setWeightOpen] = useState(false);
  const [workoutOpen, setWorkoutOpen] = useState(false);

  const overview = useResource(() => getOverview(period), [period]);

  useFocusRefresh(overview.refresh);
  // Water logged from the FAB while this tab is open changes the health score
  // the summary card is showing.
  useDataChanged(['metrics', 'workouts'], overview.refresh);

  // The weight line is sampled from weigh-ins; the last point is the prefill.
  const lastWeight = overview.data?.charts.weight.data.at(-1) ?? null;

  const onTabChange = (next: Tab) => {
    setTab(next);
    if (next !== 'tips') setPeriod(next);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Progress</Text>
        <Segmented options={tabs} value={tab} onChange={onTabChange} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={overview.refreshing}
            onRefresh={overview.refresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.xl },
        ]}
      >
        {overview.loading ? <LoadingState label="Building your analytics…" /> : null}

        {overview.error && !overview.data ? (
          <ErrorState message={overview.error.message} onRetry={overview.refresh} />
        ) : null}

        {overview.data ? (
          tab === 'tips' ? (
            <TipsList tips={tipsFor(overview.data)} />
          ) : (
            <>
              <HealthSummaryCard
                healthScore={overview.data.healthScore}
                fitnessStats={overview.data.fitnessStats}
              />
              <BodyProgressCard
                weight={overview.data.charts.weight}
                bodyStats={overview.data.bodyStats}
                period={overview.data.period}
                onLogWeight={() => setWeightOpen(true)}
              />
              <NutritionProgressCard
                calories={overview.data.charts.calories}
                macros={overview.data.macros}
              />
              <WaterIntakeCard water={overview.data.charts.water} />
              <FitnessProgressCard
                workout={overview.data.charts.workout}
                fitnessStats={overview.data.fitnessStats}
                onLogWorkout={() => setWorkoutOpen(true)}
              />
              <AchievementsCard achievements={overview.data.achievements} />
              <MilestonesCard milestones={overview.data.milestones} />
            </>
          )
        ) : null}
      </ScrollView>

      <LogWeightSheet
        visible={weightOpen}
        onClose={() => setWeightOpen(false)}
        currentKg={lastWeight}
        onSaved={overview.refresh}
      />
      <LogWorkoutSheet
        visible={workoutOpen}
        onClose={() => setWorkoutOpen(false)}
        onSaved={overview.refresh}
      />
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
    gap: spacing.lg,
  },
});

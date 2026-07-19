import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segmented } from '@/components/ui/Segmented';
import { colors, layout, spacing, typography } from '@/theme';

import { AchievementsCard } from './progress/AchievementsCard';
import { BodyProgressCard } from './progress/BodyProgressCard';
import { FitnessProgressCard } from './progress/FitnessProgressCard';
import { HealthSummaryCard } from './progress/HealthSummaryCard';
import { MilestonesCard } from './progress/MilestonesCard';
import { NutritionProgressCard } from './progress/NutritionProgressCard';
import { TipsList } from './progress/TipsList';
import { WaterIntakeCard } from './progress/WaterIntakeCard';
import type { ProgressPeriod } from './progress/progressData';

type Tab = ProgressPeriod | 'tips';

const tabs = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'tips', label: 'Tips' },
] as const;

export function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('week');

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Progress</Text>
        <Segmented options={tabs} value={tab} onChange={setTab} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.xl },
        ]}
      >
        {tab === 'tips' ? (
          <TipsList />
        ) : (
          <>
            <HealthSummaryCard />
            <BodyProgressCard period={tab} />
            <NutritionProgressCard period={tab} />
            <WaterIntakeCard period={tab} />
            <FitnessProgressCard period={tab} />
            <AchievementsCard />
            <MilestonesCard />
          </>
        )}
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
    gap: spacing.lg,
  },
});

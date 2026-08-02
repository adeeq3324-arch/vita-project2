import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { useDataChanged, useFocusRefresh, useResource } from '@/hooks';
import { getFeed } from '@/services/home/homeService';
import { colors, layout, spacing } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { ActivitiesCard } from './home/ActivitiesCard';
import { AIInsightCard } from './home/AIInsightCard';
import { dayLabel, insightFor, motivationFor, toCalendarDate } from './home/homeFormat';
import { HealthScoreCard } from './home/HealthScoreCard';
import { HomeHeader } from './home/HomeHeader';
import { MotivationCard } from './home/MotivationCard';
import { OverviewGrid } from './home/OverviewGrid';
import { ProgressOverviewCard } from './home/ProgressOverviewCard';
import { WeekStrip } from './home/WeekStrip';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const date = toCalendarDate(selectedDay);
  const feed = useResource(() => getFeed(date), [date]);

  // Meals and workouts are logged from other screens; coming back to the
  // dashboard must show what they changed.
  useFocusRefresh(feed.refresh);
  // Water is logged from the FAB, in a sheet over this screen — focus never
  // changes, so the tiles would otherwise sit still while the total moves.
  useDataChanged(['diary', 'metrics', 'workouts'], feed.refresh);

  const label = dayLabel(selectedDay);

  // Profile lives in the parent stack (it isn't a tab), so reach it via the parent.
  const openProfile = useCallback(
    () => navigation.getParent<NativeStackNavigationProp<MainStackParamList>>()?.navigate('Profile'),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <HomeHeader
          name={feed.data?.name?.trim() || 'there'}
          onProfilePress={openProfile}
          onNotificationsPress={() => {
            // Notifications screen arrives with the Smart Notifications feature.
          }}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.content,
          // Clear the floating tab bar + FAB at the bottom.
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.xl },
        ]}
      >
        <WeekStrip selected={selectedDay} onSelect={setSelectedDay} />

        {feed.loading ? <LoadingState label="Loading your day…" /> : null}

        {feed.error && !feed.data ? (
          <ErrorState message={feed.error.message} onRetry={feed.refresh} />
        ) : null}

        {feed.data ? (
          <>
            <HealthScoreCard score={feed.data.healthScore} />

            <View style={styles.section}>
              <SectionHeader title={`${label}'s Overview`} />
              <OverviewGrid metrics={feed.data.metrics} />
            </View>

            <View style={styles.section}>
              <SectionHeader
                title={`${label}'s Activities`}
                action={`${feed.data.activitiesCompleted}/${feed.data.activities.length} Completed`}
              />
              <ActivitiesCard activities={feed.data.activities} />
            </View>

            <View style={styles.section}>
              <AIInsightCard insight={insightFor(feed.data)} />
            </View>

            <View style={styles.section}>
              <SectionHeader title="Progress Overview" />
              <ProgressOverviewCard progress={feed.data.progress} />
            </View>

            <View style={styles.section}>
              <MotivationCard motivation={motivationFor(selectedDay, feed.data.name.trim())} />
            </View>
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
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.lg,
  },
  section: {
    // Sections already separated by the content container's `gap`.
  },
});

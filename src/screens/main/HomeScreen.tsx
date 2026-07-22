import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors, layout, spacing } from '@/theme';
import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

import { ActivitiesCard } from './home/ActivitiesCard';
import { AIInsightCard } from './home/AIInsightCard';
import { activitiesFor, completedCount, dayLabel } from './home/homeData';
import { HealthScoreCard } from './home/HealthScoreCard';
import { HomeHeader } from './home/HomeHeader';
import { MotivationCard } from './home/MotivationCard';
import { OverviewGrid } from './home/OverviewGrid';
import { ProgressOverviewCard } from './home/ProgressOverviewCard';
import { WeekStrip } from './home/WeekStrip';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data } = useOnboarding();
  const firstName = data.username.trim() || 'there';

  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // Section headers and the activities count follow the selected day.
  const label = dayLabel(selectedDay);
  const dayActivities = activitiesFor(selectedDay);
  const activitiesDone = completedCount(dayActivities);

  // Profile lives in the parent stack (it isn't a tab), so reach it via the parent.
  const openProfile = () =>
    navigation.getParent<NativeStackNavigationProp<MainStackParamList>>()?.navigate('Profile');

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <HomeHeader
          name={firstName}
          onProfilePress={openProfile}
          onNotificationsPress={() => {
            // Notifications screen arrives with the Smart Notifications feature.
          }}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // Clear the floating tab bar + FAB at the bottom.
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing.xl },
        ]}
      >
        <WeekStrip selected={selectedDay} onSelect={setSelectedDay} />

        <HealthScoreCard date={selectedDay} />

        <View style={styles.section}>
          <SectionHeader title={`${label}'s Overview`} action="Edit" onActionPress={() => {}} />
          <OverviewGrid date={selectedDay} />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={`${label}'s Activities`}
            action={`${activitiesDone}/${dayActivities.length} Completed`}
          />
          <ActivitiesCard date={selectedDay} />
        </View>

        <View style={styles.section}>
          <AIInsightCard date={selectedDay} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Progress Overview" />
          <ProgressOverviewCard date={selectedDay} />
        </View>

        <View style={styles.section}>
          <MotivationCard date={selectedDay} />
        </View>
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

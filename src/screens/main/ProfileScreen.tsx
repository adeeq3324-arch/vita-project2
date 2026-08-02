import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { ErrorState, LoadingState } from '@/components/ui/StateView';
import { useFocusRefresh, useResource } from '@/hooks';
import { profileService } from '@/services';
import { colors, radius, spacing, typography } from '@/theme';
import { activityLabels, genderLabels, goalLabels } from '@/utils/profileLabels';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Profile'>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/** "Member since March 2026" — the one status line that is a fact about the account. */
function memberSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Member';
  return `Member since ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
}

export function ProfileScreen({ navigation }: Props) {
  // Read from the account rather than the onboarding buffer: that buffer is
  // empty for a returning user, and stale for anyone who edited on another
  // device.
  const overview = useResource(() => profileService.getOverview(), []);
  useFocusRefresh(overview.refresh);

  const profile = overview.data?.profile ?? null;
  const goal = overview.data?.goal ?? null;
  const conditions = overview.data?.conditions ?? [];

  const name = profile?.username.trim() || 'Your profile';

  const info: { label: string; value: string }[] = [
    { label: 'Age', value: profile ? `${profile.age}` : '—' },
    { label: 'Gender', value: profile ? genderLabels[profile.gender] : '—' },
    { label: 'Height', value: profile ? `${profile.height} cm` : '—' },
    { label: 'Weight', value: profile ? `${profile.weight} kg` : '—' },
    { label: 'Goal', value: goal ? goalLabels[goal.primaryGoal] : '—' },
    {
      label: 'Target Weight',
      value: goal?.targetWeight != null ? `${goal.targetWeight} kg` : '—',
    },
    { label: 'Activity Level', value: profile ? activityLabels[profile.activityLevel] : '—' },
    {
      label: 'Health Conditions',
      value: conditions.length > 0 ? `${conditions.length} Selected` : 'None',
    },
  ];

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <View style={styles.headerRow}>
        <BackButton />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Avatar name={name} size={88} />
          <Text style={styles.name}>{name}</Text>
          {profile ? <Text style={styles.member}>{memberSince(profile.createdAt)}</Text> : null}
        </View>

        {overview.loading ? <LoadingState label="Loading your profile…" /> : null}

        {overview.error && !overview.data ? (
          <ErrorState message={overview.error.message} onRetry={overview.refresh} />
        ) : null}

        {overview.data ? (
          <>
            <Text style={styles.sectionTitle}>My Information</Text>
            <Card>
              {info.map((item, index) => (
                <View key={item.label}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <InfoRow label={item.label} value={item.value} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Account</Text>
        <Card padding="none" style={styles.listCard}>
          <ListRow
            icon="account-edit-outline"
            label="Edit Profile"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <View style={styles.divider} />
          <ListRow
            icon="target"
            label="Change Goal"
            value={goal ? goalLabels[goal.primaryGoal] : undefined}
            onPress={() => navigation.navigate('ChangeGoal')}
          />
          <View style={styles.divider} />
          <ListRow
            icon="heart-pulse"
            label="Health Conditions"
            value={conditions.length > 0 ? `${conditions.length}` : 'None'}
            onPress={() => navigation.navigate('EditHealthConditions')}
          />
        </Card>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <Card padding="none" style={styles.listCard}>
          <ListRow
            icon="bell-outline"
            label="Reminders"
            onPress={() => navigation.navigate('Reminders')}
          />
          <View style={styles.divider} />
          <ListRow
            icon="cog-outline"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  name: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  member: {
    ...typography.caption,
    color: colors.text.tertiary,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  listCard: {
    paddingHorizontal: spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  infoValue: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
});

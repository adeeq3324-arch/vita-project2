import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/layout/BackButton';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useOnboarding } from '@/context/OnboardingContext';
import { colors, radius, spacing, typography } from '@/theme';
import {
  activityLabels,
  conditionsCount,
  genderLabels,
  goalLabel,
} from '@/utils/profileLabels';
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

export function ProfileScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const name = data.username.trim() || 'Your profile';
  const conditions = conditionsCount(data.conditions);

  const info: { label: string; value: string }[] = [
    { label: 'Age', value: data.age ? `${data.age}` : '—' },
    { label: 'Gender', value: data.gender ? genderLabels[data.gender] : '—' },
    { label: 'Height', value: data.height ? `${data.height} cm` : '—' },
    { label: 'Weight', value: data.weight ? `${data.weight} kg` : '—' },
    { label: 'Goal', value: goalLabel(data.goal) },
    { label: 'Target Weight', value: data.targetWeight ? `${data.targetWeight} kg` : '—' },
    { label: 'Activity Level', value: data.activityLevel ? activityLabels[data.activityLevel] : '—' },
    { label: 'Health Conditions', value: conditions > 0 ? `${conditions} Selected` : 'None' },
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
          <View style={styles.membership}>
            <MaterialCommunityIcons name="crown" size={13} color={colors.warning} />
            <Text style={styles.membershipText}>Gold Member</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>My Information</Text>
        <Card>
          {info.map((item, index) => (
            <View key={item.label}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <InfoRow label={item.label} value={item.value} />
            </View>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>Account</Text>
        <Card padding="none" style={styles.listCard}>
          <ListRow icon="account-edit-outline" label="Edit Profile" onPress={() => {}} />
          <View style={styles.divider} />
          <ListRow icon="target" label="Change Goal" onPress={() => {}} />
          <View style={styles.divider} />
          <ListRow icon="heart-pulse" label="Health Conditions" onPress={() => {}} />
        </Card>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <Card padding="none" style={styles.listCard}>
          <ListRow icon="bell-outline" label="Reminders" onPress={() => navigation.navigate('Reminders')} />
          <View style={styles.divider} />
          <ListRow icon="cog-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
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
  membership: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.warningSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  membershipText: {
    ...typography.micro,
    color: '#B45309',
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

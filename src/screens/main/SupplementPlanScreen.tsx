import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePlan } from '@/context/PlanContext';
import { supplementSchedule } from '@/services/ai';
import { colors, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

import { GenerateGate } from './planning/GenerateGate';
import { SupplementTimeline } from './planning/SupplementTimeline';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementPlan'>;

export function SupplementPlanScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const { status, generate } = usePlan();

  if (status.supplement !== 'ready') {
    return (
      <Screen edges={{ top: true, bottom: false }}>
        <DetailHeader title="Supplement Plan" />
        <GenerateGate
          icon="pill"
          accent="violet"
          title="Your AI Supplement Plan"
          description="Generate a monthly supplement stack matched to your goal and health profile."
          points={['A monthly supply', 'Timed daily routine', 'Tailored to your conditions']}
          loading={status.supplement === 'generating'}
          onGenerate={() => generate('supplement')}
        />
      </Screen>
    );
  }

  const supplements = supplementSchedule(data);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Monthly Supplement Plan" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <MaterialCommunityIcons name="calendar-month" size={18} color={colors.primary} />
          <Text style={styles.bannerText}>One month's supply · {supplements.length} supplements · refill monthly</Text>
        </View>

        <Text style={styles.sectionTitle}>Daily Schedule</Text>
        <Card>
          <SupplementTimeline
            supplements={supplements}
            onSelect={(id) => navigation.navigate('SupplementDetail', { id })}
          />
        </Card>
        <View style={styles.note}>
          <Text style={styles.noteText}>Stay consistent and drink plenty of water.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  bannerText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  note: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  noteText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});

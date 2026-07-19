import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { useOnboarding } from '@/context/OnboardingContext';
import { supplementSchedule } from '@/services/ai';
import { colors, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

import { SupplementTimeline } from './planning/SupplementTimeline';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementPlan'>;

export function SupplementPlanScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const supplements = supplementSchedule(data);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Supplement Plan" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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

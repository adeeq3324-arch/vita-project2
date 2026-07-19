import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { useOnboarding } from '@/context/OnboardingContext';
import { supplementDetail } from '@/services/ai';
import { colors, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'SupplementDetail'>;

export function SupplementDetailScreen({ route }: Props) {
  const { data } = useOnboarding();
  const detail = supplementDetail(route.params.id, data);

  const sections = [
    { icon: 'target' as const, title: 'Purpose', body: detail.purpose },
    { icon: 'clock-outline' as const, title: 'Best Time', body: detail.bestTime },
    { icon: 'beaker-outline' as const, title: 'Dosage', body: detail.dosage },
    { icon: 'lightbulb-on-outline' as const, title: 'Tips', body: detail.tips },
  ];

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title={detail.name} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentSurface[detail.accent] }]}>
            <MaterialCommunityIcons name={detail.icon} size={44} color={colors.accent[detail.accent]} />
          </View>
          <Text style={styles.name}>{detail.name}</Text>
          <View style={styles.aiTag}>
            <MaterialCommunityIcons name="robot-happy" size={13} color={colors.primary} />
            <Text style={styles.aiTagText}>AI personalized for your profile</Text>
          </View>
        </View>

        {sections.map((section) => (
          <Card key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name={section.icon} size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
    color: colors.text.primary,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  aiTagText: {
    ...typography.micro,
    color: colors.primary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  sectionBody: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 21,
  },
});

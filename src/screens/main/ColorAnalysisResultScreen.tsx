import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useOnboarding } from '@/context/OnboardingContext';
import { analyzeFoodColor } from '@/services/ai';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'ColorAnalysisResult'>;

export function ColorAnalysisResultScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const result = analyzeFoodColor(data);

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Food Analysis" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <LinearGradient
          colors={['#5B21B6', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>{result.score}</Text>
            <Text style={styles.scoreTag}>Fresh</Text>
          </View>
        </LinearGradient>

        <Text style={styles.label}>{result.label}</Text>
        <Text style={styles.summary}>{result.summary}</Text>

        <Card style={styles.checklist}>
          {result.insights.map((insight, index) => (
            <View key={insight}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.checkRow}>
                <View style={styles.checkIcon}>
                  <MaterialCommunityIcons name="check" size={15} color={colors.success} />
                </View>
                <Text style={styles.checkText}>{insight}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Button label="View Recommendations" onPress={() => navigation.navigate('Tabs', { screen: 'Planning' })} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  scoreBadge: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: 'rgba(17,24,39,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  scoreValue: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.white,
  },
  scoreTag: {
    ...typography.label,
    color: colors.success,
  },
  label: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
  },
  summary: {
    ...typography.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginHorizontal: spacing.base,
    marginTop: -spacing.xs,
  },
  checklist: {
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  checkIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
});

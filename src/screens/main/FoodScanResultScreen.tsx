import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HealthScoreBar } from '@/components/scanner/HealthScoreBar';
import { useFoodDiary } from '@/context/FoodDiaryContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { analyzeFoodScan } from '@/services/ai';
import { colors, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'FoodScanResult'>;

export function FoodScanResultScreen({ navigation }: Props) {
  const { data } = useOnboarding();
  const { addMeal } = useFoodDiary();
  const result = analyzeFoodScan(data);

  const getMacro = (label: string) => result.nutrients.find((n) => n.label === label)?.value ?? 0;

  // The entry is persisted, so navigation waits for the write: sending the user
  // to a diary that does not yet contain what they just added reads as a bug.
  const addToDiary = async () => {
    try {
      await addMeal({
        name: result.name,
        kcal: result.calories,
        protein: getMacro('Protein'),
        carbs: getMacro('Carbs'),
        fat: getMacro('Fat'),
        icon: result.icon,
        accent: result.accent,
      });
      navigation.navigate('FoodTracking');
    } catch (error) {
      Alert.alert(
        'Could not log that meal',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <Screen edges={{ top: true, bottom: false }}>
      <DetailHeader title="Scan Result" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Card style={styles.headCard}>
          <View style={[styles.thumb, { backgroundColor: colors.accentSurface[result.accent] }]}>
            <MaterialCommunityIcons name={result.icon} size={40} color={colors.accent[result.accent]} />
          </View>
          <View style={styles.headCopy}>
            <Text style={styles.name}>{result.name}</Text>
            <Text style={styles.calories}>{result.calories} kcal</Text>
            <View style={styles.badge}>
              <MaterialCommunityIcons name="check-decagram" size={13} color={colors.success} />
              <Text style={styles.badgeText}>{result.badge}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View style={styles.nutrients}>
            {result.nutrients.map((nutrient, index) => (
              <View key={nutrient.label} style={styles.nutrientRow}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.nutrientInner}>
                  <Text style={styles.nutrientLabel}>{nutrient.label}</Text>
                  <Text style={styles.nutrientValue}>
                    {nutrient.value} {nutrient.unit}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <HealthScoreBar score={result.healthScore} label="Great Choice!" />
        </Card>

        <View style={styles.insight}>
          <View style={styles.robot}>
            <MaterialCommunityIcons name="robot-happy" size={20} color={colors.white} />
          </View>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>AI Insight</Text>
            <Text style={styles.insightBody}>{result.insight}</Text>
          </View>
        </View>

        <Button label="Add to Diary" onPress={addToDiary} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  headCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: { flex: 1 },
  name: {
    ...typography.h3,
    color: colors.text.primary,
  },
  calories: {
    ...typography.bodyStrong,
    color: colors.metric.calories,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.successSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  badgeText: {
    ...typography.micro,
    color: colors.success,
  },
  nutrients: {
    gap: 0,
  },
  nutrientRow: {},
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  nutrientInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  nutrientLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  nutrientValue: {
    ...typography.bodyStrong,
    color: colors.text.primary,
  },
  insight: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.primary + '22',
  },
  robot: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: { flex: 1 },
  insightTitle: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  insightBody: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});

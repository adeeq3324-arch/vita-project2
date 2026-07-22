import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/layout/DetailHeader';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { useOnboarding } from '@/context/OnboardingContext';
import { mealDetail } from '@/services/ai';
import { colors, radius, spacing, typography } from '@/theme';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'MealDetail'>;

export function MealDetailScreen({ route }: Props) {
  const { data } = useOnboarding();
  const detail = mealDetail(route.params.day, route.params.type, data);

  const macros = [
    { label: 'Protein', value: `${detail.protein}g`, color: colors.metric.protein },
    { label: 'Carbs', value: `${detail.carbs}g`, color: colors.metric.carbs },
    { label: 'Fat', value: `${detail.fat}g`, color: colors.metric.fat },
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

        <Card style={styles.macroCard}>
          <View style={styles.macroMain}>
            <Text style={styles.macroMainLabel}>Calories</Text>
            <Text style={styles.macroMainValue}>
              {detail.kcal.toLocaleString()} <Text style={styles.macroMainUnit}>kcal</Text>
            </Text>
          </View>
          <View style={styles.macroRow}>
            {macros.map((macro) => (
              <View key={macro.label} style={styles.macro}>
                <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
                <Text style={styles.macroValue}>{macro.value}</Text>
                <Text style={styles.macroLabel}>{macro.label}</Text>
              </View>
            ))}
            <View style={styles.macro}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={colors.text.tertiary} />
              <Text style={styles.macroValue}>{detail.prepMin}m</Text>
              <Text style={styles.macroLabel}>Prep</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="basket-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Ingredients</Text>
          </View>
          {detail.ingredients.map((item) => (
            <View key={item} style={styles.listRow}>
              <View style={styles.bullet} />
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="chef-hat" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Recipe</Text>
          </View>
          {detail.steps.map((step, index) => (
            <View key={step} style={styles.listRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Tip</Text>
          </View>
          <Text style={styles.sectionBody}>{detail.tip}</Text>
        </Card>
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
    textAlign: 'center',
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
  macroCard: {
    gap: spacing.md,
  },
  macroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroMainLabel: {
    ...typography.h4,
    color: colors.text.primary,
  },
  macroMainValue: {
    ...typography.h2,
    color: colors.primary,
  },
  macroMainUnit: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macro: {
    flex: 1,
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  macroValue: {
    ...typography.bodyStrong,
    color: colors.text.primary,
    marginTop: 2,
  },
  macroLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
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
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  listText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 21,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: '700',
  },
});
